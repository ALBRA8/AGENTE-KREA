import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import { chargeForCapability, refundCharge, type ChargeResult } from "@/lib/credit-service";
import { refundCreditsOnce } from "@/lib/auth";
import {
  resolveFactory,
  type ExecutionBlueprint,
  type ProductType,
} from "@/lib/product-factory-orchestrator";
import { launchFactoryRun } from "@/lib/production-recovery";

/**
 * POST /api/product/factory/execute
 * Ejecuta una fábrica para un producto — ASYNC (FASE 2): cobra, crea la
 * FactoryExecution RUNNING y responde 202 de inmediato; la fábrica corre en
 * segundo plano (production-recovery.ts) y avanza el dossier PRODUCING → QA
 * (éxito) o → FAILED (fallo, con reembolso de los créditos cobrados).
 *
 * Body: { productId, factoryType?, contract? }
 *   - factoryType es opcional: se deriva del tipo de producto (resolveFactory).
 *   - contract (opcional): { blueprintId?, productVersion?, chapters?, inputAssets? }
 *
 * Estado consultable: GET /api/product/factory/[executionId] y
 * GET /api/product/produce/[id]. Al arrancar el servidor,
 * src/instrumentation.ts ejecuta recoverStaleRuns() para huérfanos de reinicio.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let chargeRef: ChargeResult | null = null;
  try {
    const body = await req.json();
    const { productId, factoryType, contract } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "productId es obligatorio" },
        { status: 400 }
      );
    }

    // Verify dossier ownership
    const dossier = await db.productDossier.findFirst({
      where: { id: productId, userId: user.id },
    });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier no encontrado o sin permisos" }, { status: 404 });
    }

    // Cobro atómico antes de lanzar la fábrica. Reembolso en cualquier fallo.
    const charge = await chargeForCapability(token, "product:factory-execute");
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }
    chargeRef = charge;

    // FASE 2.4 — un solo run activo por producto (transición condicionada).
    const claim = await db.productDossier.updateMany({
      where: { id: productId, status: { not: "PRODUCING" } },
      data: { status: "PRODUCING" },
    });
    if (claim.count === 0) {
      await refundCreditsOnce(user.id, charge.cost, "product:factory-execute", `execute-claim-${productId}`);
      return NextResponse.json(
        { error: "Ya hay una producción activa para este producto", refunded: true },
        { status: 409 }
      );
    }

    const contractObj = typeof contract === "string" && contract ? safeParse(contract) : (contract ?? {});
    const resolvedType = (factoryType ??
      resolveFactory(dossier.domain as ProductType)) as string;

    const execution = await db.factoryExecution.create({
      data: {
        userId: user.id,
        executionId: createId(),
        productId,
        factoryType: resolvedType,
        contract: JSON.stringify({
          ...contractObj,
          chargedCredits: charge.cost,
          capability: "product:factory-execute",
        }),
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    const blueprint: ExecutionBlueprint = {
      blueprintId:
        (typeof contractObj.blueprintId === "string" && contractObj.blueprintId) ||
        `direct-${dossier.id}`,
      productId: dossier.id,
      productVersion:
        (typeof contractObj.productVersion === "string" && contractObj.productVersion) ||
        `1.0.${dossier.version}`,
      productType: dossier.domain as ProductType,
      title: dossier.title,
      author: user.name,
      inputAssets: Array.isArray(contractObj.inputAssets)
        ? contractObj.inputAssets
        : undefined,
      requiredProviders: ["text", "image"],
    };

    // Lanzar en segundo plano: la fábrica avanza la ejecución y el dossier,
    // reembolsa en fallo. Respuesta 202 inmediata.
    launchFactoryRun({
      executionDbId: execution.id,
      userId: user.id,
      dossierId: dossier.id,
      blueprint,
      capability: "product:factory-execute",
      chargedCredits: charge.cost,
    });

    return NextResponse.json(
      {
        executionId: execution.executionId,
        productId,
        factoryType: resolvedType,
        status: "RUNNING",
        mode: "async",
        poll: `/api/product/factory/${execution.executionId}`,
        credits: charge.creditsLeft,
      },
      { status: 202 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error ejecutando factory";
    if (chargeRef) await refundCharge(chargeRef.userId, "product:factory-execute");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
