/**
 * Global setup de vitest — se ejecuta UNA vez en el proceso principal antes
 * de arrancar los workers (hallazgo 0.3: los tests usaban la BD de desarrollo).
 *
 * 1. Borra cualquier `prisma/test.db` de corridas anteriores (BD limpia siempre).
 * 2. Hace push del esquema completo contra `file:./prisma/test.db`.
 *
 * El DATABASE_URL de los tests se fija en `src/test/setup.ts`, que corre antes
 * de cada archivo de test (los imports de `@/lib/db` leen la env al instanciarse).
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const TEST_DB_URL = "file:./test.db"; // relativo al dir del schema → prisma/test.db

export default function globalSetup(): void {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const f = path.resolve("prisma/test.db" + suffix);
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  execSync("npx prisma db push --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });
  // El push terminó: marcarlo también para el proceso principal.
  process.env.DATABASE_URL = TEST_DB_URL;
}
