import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";
import {
  executeFactory,
  resolveFactory,
  type ExecutionBlueprint,
  type ProductType,
} from "@/lib/product-factory-orchestrator";

/**
 * POST /api/product/factory/execute
 * Execute a factory for a product — SYNCHRONOUSLY (P6 decision documented in
 * INFORME-ESTADO.md §7.6: before this wiring the route only created a
 * FactoryExecution row without ever running the factory).
 *
 * Body: { productId, factoryType?, contract? }
 *   - factoryType is optional: it is derived from the product type
 *     (resolveFactory) when omitted.
 *   - contract (optional): { blueprintId?, productVersion?, chapters?, inputAssets? }
 *
 * The dossier is advanced PRODUCING → QA on success, → FAILED on error.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let charge: ChargeResult | ChargeError | null = null;
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

    // Cobro atómico antes de ejecutar la fábrica. Reembolso en cualquier fallo.
    charge = await chargeForCapability(token, "product:factory-execute");
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
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
        contract: JSON.stringify(contractObj),
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

    let result;
    try {
      result = await executeFactory(blueprint);
    } catch (runErr) {
      const runMsg = runErr instanceof Error ? runErr.message : String(runErr);
      await db.factoryExecution.update({
        where: { id: execution.id },
        data: { status: "FAILED", error: runMsg, completedAt: new Date() },
      });
      // Fallo del proveedor/pipeline → reembolso
      if (charge.ok) await refundCharge(charge.userId, "product:factory-execute");
      return NextResponse.json(
        { error: `Factory falló: ${runMsg}`, executionId: execution.executionId, refunded: true },
        { status: 500 }
      );
    }

    // Resultado no exitoso del pipeline → reembolso también
    const failed = !(result.status === "COMPLETED" || result.status === "PASSED");
    if (failed && charge.ok) {
      await refundCharge(charge.userId, "product:factory-execute");
    }

    const updatedExec = await db.factoryExecution.update({
      where: { id: execution.id },
      data: {
        status: result.status,
        progress: JSON.stringify(result.progress),
        artifacts: JSON.stringify(result.artifacts),
        qaReport: result.qaReport ? JSON.stringify(result.qaReport) : null,
        error: result.error,
        completedAt: result.completedAt ?? new Date(),
      },
    });

    // Advance the dossier lifecycle ONLY from PRODUCING (state machine safe):
    // PRODUCING → QA on success, PRODUCING → FAILED otherwise.
    if (dossier.status === "PRODUCING") {
      if (result.status === "COMPLETED" || result.status === "PASSED") {
        await db.productDossier.update({
          where: { id: dossier.id },
          data: {
            status: "QA",
            artifacts: JSON.stringify(result.artifacts),
            timeline: JSON.stringify([
              ...readTimeline(dossier.timeline),
              { step: "FACTORY_EXECUTED", timestamp: new Date().toISOString(), executionId: result.executionId },
              { step: "QA", timestamp: new Date().toISOString() },
            ]),
          },
        });
      } else {
        await db.productDossier.update({
          where: { id: dossier.id },
          data: {
            status: "FAILED",
            timeline: JSON.stringify([
              ...readTimeline(dossier.timeline),
              { step: "FACTORY_FAILED", timestamp: new Date().toISOString(), error: result.error },
            ]),
          },
        });
      }
    }

    return NextResponse.json(
      { execution: updatedExec, result, credits: charge.ok ? charge.creditsLeft : undefined, refunded: failed || undefined },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error ejecutando factory";
    if (charge?.ok) await refundCharge(charge.userId, "product:factory-execute");
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

function readTimeline(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as unknown[];
  } catch {
    return [];
  }
}
