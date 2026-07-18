// Ensures DB schema exists and seeds a default user if needed
// Runs automatically before `next start` via prestart script

const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");

async function main() {
  const dbPath = path.join(process.cwd(), "db");
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
    console.log("[ensure-db] Created db/ directory");
  }

  const prisma = new PrismaClient();
  try {
    // Push schema (creates tables if missing, safe to run multiple times)
    await prisma.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS `_prisma_migrations` (id TEXT PRIMARY KEY)").catch(() => {});
    
    // Check if User table exists
    const userCount = await prisma.user.count().catch(() => 0);
    if (userCount === 0) {
      // Seed default user
      await prisma.user.create({
        data: {
          name: "Usuario Demo",
          email: "demo@p360.com",
          password: "demo123",
          credits: 50,
          plan: "starter",
        },
      });
      console.log("[ensure-db] Seeded default user: demo@p360.com / demo123");
    } else {
      console.log(`[ensure-db] DB ready (${userCount} user(s))`);
    }
  } catch (e) {
    console.error("[ensure-db] Error:", e.message);
    // Try schema push as fallback
    console.log("[ensure-db] Attempting prisma db push...");
    const { execSync } = require("child_process");
    try {
      execSync("npx prisma db push --skip-generate 2>&1", { stdio: "inherit" });
      console.log("[ensure-db] Schema pushed successfully");
    } catch (pushErr) {
      console.error("[ensure-db] Schema push failed:", pushErr.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();