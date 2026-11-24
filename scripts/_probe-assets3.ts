process.env.DATABASE_URL = "file:./test.db";
process.env.KREA_PDF_OUTPUT_DIR = "/tmp/probe-assets3-" + Date.now();
import { setProviderOverride } from "../src/contracts/provider-registry";
import { createDeterministicMockProvider } from "../src/test/mock-provider";
setProviderOverride("text", createDeterministicMockProvider("text"));
setProviderOverride("image", createDeterministicMockProvider("image"));
import { launchFactoryRun } from "../src/lib/production-recovery";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const u = await db.user.create({ data: { name: "Probe C", email: `probe-c-${Date.now()}@x.local`, password: "x", credits: 100 } });
  const d = await db.productDossier.create({ data: { userId: u.id, title: "Probe libro tres", description: "Descripción del probe libro tres", domain: "ebook", status: "IDEA" } });
  const execution = await db.factoryExecution.create({
    data: { userId: u.id, executionId: `probe3-${Date.now()}`, productId: d.id, factoryType: "book_factory",
      contract: JSON.stringify({ chargedCredits: 0, capability: "product:produce" }), status: "RUNNING", startedAt: new Date() },
  });
  launchFactoryRun({ executionDbId: execution.id, userId: u.id, dossierId: d.id,
    blueprint: { blueprintId: "probe3", productId: d.id, productVersion: "1.0.0", productType: "ebook", title: "Probe libro tres", author: "KREA", requiredProviders: ["text", "image"] } as never,
    capability: "product:produce", chargedCredits: 0 });
  for (let i = 0; i < 40; i++) {
    const e = await db.factoryExecution.findUnique({ where: { id: execution.id } });
    if (e?.completedAt) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const e = await db.factoryExecution.findUnique({ where: { id: execution.id } });
  console.log("status:", e?.status);
  const qa = e?.qaReport ? JSON.parse(e.qaReport) : null;
  console.log("qaReport keys:", qa ? Object.keys(qa).join(",") : "none");
  const raw = JSON.stringify(qa, null, 1).slice(0, 2200);
  console.log(raw);
  await db.$disconnect();
}
main();
