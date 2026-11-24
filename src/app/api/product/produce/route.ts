import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, refundCreditsOnce } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import { chargeForCapability, refundCharge, type ChargeResult } from "@/lib/credit-service";
import {
  resolveFactory,
  type ExecutionBlueprint,
  type ProductType,
} from "@/lib/product-factory-orchestrator";
import { launchFactoryRun } from "@/lib/production-recovery";

/**
 * GET /api/product/produce
 * List dossiers in PRODUCING status (production jobs).
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const jobs = await db.productDossier.findMany({
      where: {
        userId: user.id,
        status: { in: ["PRODUCING", "QA", "PUBLISHED", "FAILED"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Map to production job format
    const productions = jobs.map((j) => {
      const timeline = j.timeline ? JSON.parse(j.timeline) as Array<{ step: string; timestamp: string }> : [];
      const progress = j.status === "PUBLISHED" ? 100 : j.status === "QA" ? 85 : j.status === "FAILED" ? 0 : 50;
      return {
        id: j.id,
        dossierId: j.id,
        productName: j.title,
        productType: j.domain,
        status: j.status,
        progress,
        currentStep: j.status === "PUBLISHED" ? "Complete" : j.status === "QA" ? "QA checks" : j.status === "FAILED" ? "Failed" : "Producing",
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        timeline,
      };
    });

    return NextResponse.json({ jobs: productions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error loading productions";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/product/produce
 * Start production for a dossier — ASYNC (FASE 2): cobra, crea una FactoryExecution
 * RUNNING, transiciona el dossier a PRODUCING y responde 202 de inmediato con el
 * executionId; la fábrica corre en segundo plano (production-recovery.ts) y
 * avanza PRODUCING → QA (éxito) o → FAILED (fallo, con reembolso).
 *
 * Estado consultable por los GET existentes:
 *   - GET /api/product/produce/[id]          (job del dossier, para polling)
 *   - GET /api/product/factory/[executionId] (ejecución detallada)
 *   - GET /api/product/produce               (lista de jobs)
 *
 * Body: { dossierId, execute? }  (execute defaults to true; pass false to
 * only create the PRODUCING record without charging or running the pipeline).
 *
 * Al arrancar el servidor, src/instrumentation.ts ejecuta recoverStaleRuns():
 * toda ejecución RUNNING/QUEUED o dossier PRODUCING huérfano de un reinicio
 * se marca FAILED con reembolso de los créditos registrados en su contract.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let chargeRef: ChargeResult | null = null;
  try {
    const body = await req.json();
    const { dossierId, execute } = body;
    const shouldExecute = execute !== false;

    if (!dossierId) {
      return NextResponse.json({ error: "dossierId is required" }, { status: 400 });
    }

    const dossier = await db.productDossier.findUnique({
      where: { id: dossierId },
    });

    if (!dossier || dossier.userId !== user.id) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    if (!shouldExecute) {
      // FASE 5.3: execute:false ya NO escribe PRODUCING (parecía un run real y
      // la recuperación lo pasaba a FAILED "con reembolso fantasma"). Estado
      // honesto: QUEUED — en cola, SIN cobro, sin worker.
      const updated = await db.productDossier.update({
        where: { id: dossierId },
        data: {
          status: "QUEUED",
          timeline: JSON.stringify([
            ...(dossier.timeline ? JSON.parse(dossier.timeline) as unknown[] : []),
            { step: "QUEUED", timestamp: new Date().toISOString(), note: "uncharged (execute:false)" },
          ]),
        },
      });
      return NextResponse.json({
        id: updated.id,
        dossierId: updated.id,
        productName: updated.title,
        productType: updated.domain,
        status: "QUEUED",
        progress: 0,
        currentStep: "Queued (uncharged — execute:false)",
        createdAt: updated.createdAt,
      }, { status: 201 });
    }

    // Cobro atómico antes de lanzar la fábrica (12 créditos, product:produce)
    const charge = await chargeForCapability(token, "product:produce");
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }
    chargeRef = charge;

    // FASE 2.4 — un solo run activo por producto. SQLite serializa escrituras:
    // la transición condicionada la gana EXACTAMENTE un POST concurrente; el
    // otro recibe 409 y reembolso idempotente de su propio cobro.
    const claim = await db.productDossier.updateMany({
      where: { id: dossierId, status: { not: "PRODUCING" } },
      data: { status: "PRODUCING" },
    });
    if (claim.count === 0) {
      await refundCreditsOnce(user.id, charge.cost, "product:produce", `produce-claim-${dossierId}`);
      return NextResponse.json(
        { error: "Ya hay una producción activa para este producto", refunded: true },
        { status: 409 }
      );
    }

    // Ejecución registrada ANTES de responder: el cobro queda en el contract
    // (chargedCredits) para el reembolso en fallo y en la recuperación
    const blueprint: ExecutionBlueprint = {
      blueprintId: `produce-${dossier.id}`,
      productId: dossier.id,
      productVersion: `1.0.${dossier.version}`,
      productType: dossier.domain as ProductType,
      title: dossier.title,
      author: user.name,
      requiredProviders: ["text", "image"],
    };

    const execution = await db.factoryExecution.create({
      data: {
        userId: user.id,
        executionId: createId(),
        productId: dossier.id,
        factoryType: resolveFactory(dossier.domain as ProductType),
        contract: JSON.stringify({
          blueprintId: blueprint.blueprintId,
          productVersion: blueprint.productVersion,
          chargedCredits: charge.cost,
          capability: "product:produce",
        }),
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    // Transición a PRODUCING (timeline referencia la ejecución)
    const updated = await db.productDossier.update({
      where: { id: dossierId },
      data: {
        status: "PRODUCING",
        timeline: JSON.stringify([
          ...(dossier.timeline ? JSON.parse(dossier.timeline) as unknown[] : []),
          { step: "PRODUCING", timestamp: new Date().toISOString(), executionId: execution.executionId },
        ]),
      },
    });

    // Lanzar en segundo plano (fire-and-forget; la respuesta es 202 inmediata)
    launchFactoryRun({
      executionDbId: execution.id,
      userId: user.id,
      dossierId: dossier.id,
      blueprint,
      capability: "product:produce",
      chargedCredits: charge.cost,
    });

    return NextResponse.json({
      id: updated.id,
      dossierId: updated.id,
      executionId: execution.executionId,
      productName: updated.title,
      productType: updated.domain,
      status: "PRODUCING",
      progress: 0,
      currentStep: "Initializing pipeline",
      mode: "async",
      poll: `/api/product/produce/${updated.id}`,
      execution: { executionId: execution.executionId, factoryType: execution.factoryType, status: "RUNNING" },
      credits: charge.creditsLeft,
      createdAt: updated.createdAt,
    }, { status: 202 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error starting production";
    if (chargeRef) await refundCharge(chargeRef.userId, "product:produce");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
