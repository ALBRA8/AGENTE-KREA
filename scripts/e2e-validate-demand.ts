/**
 * P5 — validate-demand CON RED REAL (Google suggest autocompletado).
 *
 * Ejecuta el op del arnés por la vía de producción (bootstrap → harness →
 * plugin infoproductos → python-bridge → autocompletado.py + validar_demanda.py)
 * y documenta latencia + evidencia de red real.
 *
 * Uso: npx tsx scripts/e2e-validate-demand.ts
 */

import { bootstrapKrea } from "../src/lib/bootstrap";
import { kreaHarness } from "../src/lib/krea-harness";

async function main() {
  const t0 = Date.now();
  const boot = await bootstrapKrea();
  console.log(
    `[bootstrap] status=${boot.status} agente=${boot.agent} bridges=${boot.bridges} skills=${boot.skills} (${Date.now() - t0}ms)`
  );

  const t1 = Date.now();
  const result = await kreaHarness.executeSkill("infoproductos", "validate-demand", {
    topic: "ventas por whatsapp",
    country: "CO",
    formatPhrases: [
      "como vender por whatsapp curso",
      "manual de ventas por whatsapp",
    ],
    excludeTerms: ["gratis", "pirata"],
  });
  const latency = Date.now() - t1;

  console.log(`[validate-demand] latencia total: ${latency}ms`);
  console.log(`[validate-demand] evidence: ${result.evidence}`);

  const data = result.data as Record<string, unknown>;
  console.log(`  verdict: ${data.verdict}`);
  console.log(`  source:  ${data.source}`);
  console.log(`  reasoning: ${String(data.reasoning ?? "").slice(0, 140)}`);
  console.log(`  topics: ${(data.topics as unknown[])?.length ?? 0}`);
  console.log(`  questions: ${(data.questions as unknown[])?.length ?? 0}`);
  console.log(
    `  formatSignals: ${JSON.stringify(data.formatSignals ?? {}).slice(0, 200)}`
  );
  console.log(
    `  competitors: ${(data.competitors as unknown[])?.length ?? 0}`
  );

  // Evidencia cruda para el informe
  const fs = await import("fs");
  fs.mkdirSync("download/evidencia-validate-demand", { recursive: true });
  fs.writeFileSync(
    "download/evidencia-validate-demand/validate-demand.json",
    JSON.stringify({ latencyMs: latency, evidence: result.evidence, data }, null, 2)
  );
  console.log("[evidencia] download/evidencia-validate-demand/validate-demand.json");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
