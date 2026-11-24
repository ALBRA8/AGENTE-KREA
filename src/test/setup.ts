import "@testing-library/jest-dom/vitest";
import { afterAll } from "vitest";

/**
 * Aislamiento de BD (hallazgo 0.3): TODA suite de test corre contra
 * `file:./test.db` → `prisma/test.db` (creada por src/test/global-setup.ts;
 * las rutas `file:` relativas las resuelve Prisma respecto al directorio del
 * schema), NUNCA contra la BD de desarrollo. Este archivo corre antes de cada
 * archivo de test, así que los singletons de `@/lib/db` instancian
 * PrismaClient ya con esta URL.
 */
process.env.DATABASE_URL = "file:./test.db";

afterAll(async () => {
  const { db } = await import("@/lib/db");
  await db.$disconnect();
});
