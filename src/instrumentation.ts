/**
 * Instrumentación de arranque (Next.js) — recuperación de ejecuciones
 * en vuelo tras un reinicio del servidor (FASE 2).
 *
 * Next ejecuta register() una vez por proceso de servidor (next start / dev,
 * runtime nodejs). Si el servidor se apagó con ejecuciones RUNNING/QUEUED o
 * dossiers PRODUCING, quedaron huérfanas: se marcan FAILED y se reembolsan
 * los créditos registrados en el contract de cada ejecución.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { recoverStaleRuns } = await import("@/lib/production-recovery");
    const report = await recoverStaleRuns();
    if (report.recoveredExecutions > 0 || report.recoveredDossiers > 0) {
      console.log(
        `[instrumentation] recuperación de arranque: ${report.recoveredExecutions} ejecuciones → FAILED, ${report.recoveredDossiers} dossiers PRODUCING → FAILED, ${report.refundsIssued} reembolsos (${report.refundedCredits} créditos)`
      );
    }
  } catch (e: unknown) {
    // No bloquear el arranque: la recuperación es best-effort (p. ej. en un
    // clon fresco la BD aún no tiene el esquema)
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[instrumentation] recuperación de arranque falló (best-effort): ${msg}`);
  }
}
