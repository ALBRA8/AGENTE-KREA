import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  executeFactory,
  type ExecutionBlueprint,
  type ProductType,
} from "@/lib/product-factory-orchestrator";

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
 * Start production for a dossier: transition to PRODUCING and — by default
 * (P6 decision, INFORME-ESTADO.md §7.6) — RUN the factory synchronously,
 * advancing PRODUCING → QA (success) or → FAILED (error).
 *
 * Body: { dossierId, execute? }  (execute defaults to true; pass false to
 * only create the PRODUCING record without running the pipeline).
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // Transition to PRODUCING
    const updated = await db.productDossier.update({
      where: { id: dossierId },
      data: {
        status: "PRODUCING",
        timeline: JSON.stringify([
          ...(dossier.timeline ? JSON.parse(dossier.timeline) as unknown[] : []),
          { step: "PRODUCING", timestamp: new Date().toISOString() },
        ]),
      },
    });

    if (!shouldExecute) {
      return NextResponse.json({
        id: updated.id,
        dossierId: updated.id,
        productName: updated.title,
        productType: updated.domain,
        status: "PRODUCING",
        progress: 0,
        currentStep: "Initializing pipeline",
        createdAt: updated.createdAt,
      }, { status: 201 });
    }

    // P6: actually run the factory for the dossier (synchronous)
    const blueprint: ExecutionBlueprint = {
      blueprintId: `produce-${dossier.id}`,
      productId: dossier.id,
      productVersion: `1.0.${dossier.version}`,
      productType: dossier.domain as ProductType,
      title: dossier.title,
      author: user.name,
      requiredProviders: ["text", "image"],
    };

    const executionResult = await executeFactory(blueprint);
    const success =
      executionResult.status === "COMPLETED" || executionResult.status === "PASSED";

    // PRODUCING → QA (success) / FAILED (error) — both valid transitions
    const finalDossier = await db.productDossier.update({
      where: { id: dossierId },
      data: {
        status: success ? "QA" : "FAILED",
        artifacts: JSON.stringify(executionResult.artifacts),
        timeline: JSON.stringify([
          ...(updated.timeline ? JSON.parse(updated.timeline) as unknown[] : []),
          {
            step: success ? "FACTORY_EXECUTED" : "FACTORY_FAILED",
            timestamp: new Date().toISOString(),
            executionId: executionResult.executionId,
            error: executionResult.error ?? undefined,
          },
          ...(success ? [{ step: "QA", timestamp: new Date().toISOString() }] : []),
        ]),
      },
    });

    return NextResponse.json({
      id: finalDossier.id,
      dossierId: finalDossier.id,
      productName: finalDossier.title,
      productType: finalDossier.domain,
      status: finalDossier.status,
      progress: success ? 85 : 0,
      currentStep: success ? "QA checks" : "Factory failed",
      execution: {
        executionId: executionResult.executionId,
        factoryType: executionResult.factoryType,
        status: executionResult.status,
        artifacts: executionResult.artifacts,
        error: executionResult.error,
      },
      createdAt: finalDossier.createdAt,
    }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error starting production";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
