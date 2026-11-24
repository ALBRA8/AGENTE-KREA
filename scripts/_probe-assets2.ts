process.env.DATABASE_URL = "file:./test.db";
process.env.KREA_PDF_OUTPUT_DIR = "/tmp/probe-assets2-" + Date.now();
import { setProviderOverride } from "../src/contracts/provider-registry";
import { createDeterministicMockProvider } from "../src/test/mock-provider";
setProviderOverride("text", createDeterministicMockProvider("text"));
setProviderOverride("image", createDeterministicMockProvider("image"));
import { launchFactoryRun } from "../src/lib/production-recovery";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const u = await db.user.create({ data: { name: "Probe B", email: `probe-b-${Date.now()}@x.local`, password: "x", credits: 100 } });
  const d = await db.productDossier.create({ data: { userId: u.id, title: "Probe libro dos", description: "Descripción del probe libro dos", domain: "ebook", status: "IDEA" } });
  const execution = await db.factoryExecution.create({
    data: { userId: u.id, executionId: `probe2-${Date.now()}`, productId: d.id, factoryType: "book_factory",
      contract: JSON.stringify({ chargedCredits: 0, capability: "product:produce" }), status: "RUNNING", startedAt: new Date() },
  });
  launchFactoryRun({ executionDbId: execution.id, userId: u.id, dossierId: d.id,
    blueprint: { blueprintId: "probe2", productId: d.id, productVersion: "1.0.0", productType: "ebook", title: "Probe libro dos", author: "KREA", requiredProviders: ["text", "image"] } as never,
    capability: "product:produce", chargedCredits: 0 });
  for (let i = 0; i < 40; i++) {
    const e = await db.factoryExecution.findUnique({ where: { id: execution.id } });
    if (e?.completedAt) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const e = await db.factoryExecution.findUnique({ where: { id: execution.id } });
  console.log("status:", e?.status);
  const qa = e?.qaReport ? JSON.parse(e.qaReport) : null;
  if (qa) {
    for (const cat of [qa.artifactQA, qa.contentQA, qa.structureQA, qa.visualQA, qa.commercialQA, qa.deliveryQA]) {
      console.log(`── ${cat.category} passed=${cat.passed} score=${cat.score}`);
      for (const c of cat.checks.slice(0, 6)) console.log(`   ${c.passed ? "PASS" : "FAIL"} [${c.evidence}] ${c.name}: ${String(c.detail).slice(0, 80)}`);
      for (const i of (cat.issues ?? []).slice(0, 4)) console.log(`   ISSUE ${i.severity} ${i.description}`);
    }
    console.log("overallPassed:", qa.overallPassed, "score:", qa.overallScore);
  }
  await db.$disconnect();
}
main();
