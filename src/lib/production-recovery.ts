/**
 * Ejecución de la fábrica en segundo plano + recuperación al arrancar (FASE 2).
 *
 * - produce y factory/execute responden 202 de inmediato con executionId;
 *   la fábrica corre en background y el estado se consulta por los GET
 *   existentes: /api/product/produce/[id] (dossier) y
 *   /api/product/factory/[executionId] (FactoryExecution).
 * - El cobro de créditos queda registrado en el contract de la ejecución
 *   (chargedCredits + capability) para poder REEMBOLSAR en el fallo y en la
 *   recuperación tras un reinicio del servidor.
 * - recoverStaleRuns(): al arrancar el servidor, toda ejecución RUNNING/QUEUED
 *   quedó huérfana (no hay worker vivo) → FAILED + reembolso; todo dossier
 *   PRODUCING → FAILED + reembolso (costo de product:produce).
 */

import { db } from "@/lib/db";
import { refundCredits } from "@/lib/auth";
import { executeFactory, type ExecutionBlueprint } from "@/lib/product-factory-orchestrator";

export type ProductCapability = "product:produce" | "product:factory-execute";

export interface BackgroundRunOptions {
  executionDbId: string; // FactoryExecution.id (PK)
  userId: string;
  dossierId: string | null; // avanzar dossier solo si hay
  blueprint: ExecutionBlueprint;
  capability: ProductCapability;
  chargedCredits: number; // 0 = no hubo cobro
}

function readTimeline(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as unknown[];
  } catch {
    return [];
  }
}

/** Lanza la ejecución en segundo plano sin bloquear la respuesta (202). */
export function launchFactoryRun(opts: BackgroundRunOptions): void {
  void runFactoryInBackground(opts).catch(() => {
    // doble red de seguridad: nunca una unhandled rejection del proceso
  });
}

export async function runFactoryInBackground(opts: BackgroundRunOptions): Promise<void> {
  let result;
  try {
    result = await executeFactory(opts.blueprint);
  } catch (runErr) {
    const runMsg = runErr instanceof Error ? runErr.message : String(runErr);
    await db.factoryExecution.update({
      where: { id: opts.executionDbId },
      data: { status: "FAILED", error: runMsg, completedAt: new Date() },
    });
    await failDossierIfProducing(opts.dossierId, `factory_exception: ${runMsg}`);
    if (opts.chargedCredits > 0) {
      await refundCredits(opts.userId, opts.chargedCredits);
    }
    return;
  }

  const failed = !(result.status === "COMPLETED" || result.status === "PASSED");

  await db.factoryExecution.update({
    where: { id: opts.executionDbId },
    data: {
      status: result.status,
      progress: JSON.stringify(result.progress),
      artifacts: JSON.stringify(result.artifacts),
      qaReport: result.qaReport ? JSON.stringify(result.qaReport) : null,
      error: result.error,
      completedAt: result.completedAt ?? new Date(),
    },
  });

  // Avance del dossier SOLO desde PRODUCING (máquina de estados segura)
  if (opts.dossierId) {
    const dossier = await db.productDossier.findUnique({ where: { id: opts.dossierId } });
    if (dossier && dossier.status === "PRODUCING") {
      const success = !failed;
      await db.productDossier.update({
        where: { id: dossier.id },
        data: {
          status: success ? "QA" : "FAILED",
          ...(success ? { artifacts: JSON.stringify(result.artifacts) } : {}),
          timeline: JSON.stringify([
            ...readTimeline(dossier.timeline),
            { step: success ? "FACTORY_EXECUTED" : "FACTORY_FAILED", timestamp: new Date().toISOString(), executionId: result.executionId, ...(result.error ? { error: result.error } : {}) },
            ...(success ? [{ step: "QA", timestamp: new Date().toISOString() }] : []),
          ]),
        },
      });
    }
  }

  // Fallo del pipeline → reembolso (los pasos parciales son pérdida del sistema)
  if (failed && opts.chargedCredits > 0) {
    await refundCredits(opts.userId, opts.chargedCredits);
  }
}

async function failDossierIfProducing(dossierId: string | null, error: string): Promise<void> {
  if (!dossierId) return;
  try {
    const dossier = await db.productDossier.findUnique({ where: { id: dossierId } });
    if (dossier && dossier.status === "PRODUCING") {
      await db.productDossier.update({
        where: { id: dossier.id },
        data: {
          status: "FAILED",
          timeline: JSON.stringify([
            ...readTimeline(dossier.timeline),
            { step: "FACTORY_FAILED", timestamp: new Date().toISOString(), error },
          ]),
        },
      });
    }
  } catch {
    // best-effort
  }
}

// ─── Recuperación al arrancar el servidor ───────────────────────────

export interface RecoveryReport {
  recoveredExecutions: number;
  recoveredDossiers: number;
  refundsIssued: number;
  refundedCredits: number;
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Marca como FAILED lo que quedó en vuelo tras un reinicio y reembolsa.
 * Idempotente: si no hay nada en vuelo, no hace nada.
 */
export async function recoverStaleRuns(): Promise<RecoveryReport> {
  const report: RecoveryReport = {
    recoveredExecutions: 0,
    recoveredDossiers: 0,
    refundsIssued: 0,
    refundedCredits: 0,
  };

  // 1) Ejecuciones huérfanas (RUNNING/QUEUED sin worker vivo) → FAILED + reembolso
  const staleExecutions = await db.factoryExecution.findMany({
    where: { status: { in: ["RUNNING", "QUEUED"] } },
  });

  for (const exec of staleExecutions) {
    const contract = safeParse(exec.contract);
    const charged = typeof contract.chargedCredits === "number" ? contract.chargedCredits : 0;

    await db.factoryExecution.update({
      where: { id: exec.id },
      data: { status: "FAILED", error: "server_restart_recovery", completedAt: new Date() },
    });
    report.recoveredExecutions++;

    if (charged > 0) {
      await refundCredits(exec.userId, charged);
      report.refundsIssued++;
      report.refundedCredits += charged;
    }

    // El dossier del producto, si quedó PRODUCING, pasa a FAILED con timeline
    await failDossierIfProducing(exec.productId, "server_restart_recovery");
  }

  // 2) Dossiers PRODUCING sin ejecución viva: FAILED SIN reembolso ciego.
  //    El reembolso solo procede si hay una FactoryExecution con chargedCredits
  //    (recuperada en el paso 1). Un dossier PRODUCING sin row es o bien un
  //    registro execute:false (nunca se cobró) o un huérfano de una versión
  //    anterior cuyo cobro no es verificable — en ambos casos NO se reembolsa.
  const producingDossiers = await db.productDossier.findMany({
    where: { status: "PRODUCING" },
  });

  for (const dossier of producingDossiers) {
    await db.productDossier.update({
      where: { id: dossier.id },
      data: {
        status: "FAILED",
        timeline: JSON.stringify([
          ...readTimeline(dossier.timeline),
          { step: "SERVER_RESTART_RECOVERY", timestamp: new Date().toISOString() },
        ]),
      },
    });
    report.recoveredDossiers++;
  }

  return report;
}
