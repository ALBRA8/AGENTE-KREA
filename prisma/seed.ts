/**
 * Seed de desarrollo — NO para producción.
 *
 * Reglas (hallazgo 0.4 del informe de auditoría):
 *  - Exige `DEMO_PASSWORD` en el entorno. Si falta, se niega a sembrar
 *    (antes: demo@p360.com / demo123 en texto plano en el código).
 *  - Se niega si NODE_ENV=production, aunque DEMO_PASSWORD exista.
 *  - Solo crea el usuario si la tabla User está vacía (idempotente).
 *
 * Uso: DATABASE_URL=file:./db/custom.db DEMO_PASSWORD=... npm run db:seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.error("[seed] DENEGADO: NODE_ENV=production — el seed es solo de desarrollo.");
    process.exit(1);
  }
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    console.error("[seed] DENEGADO: define DEMO_PASSWORD en el entorno (no hay fallback en el código).");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("[seed] DENEGADO: DEMO_PASSWORD debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const { security } = await import("../src/lib/auth");
  const email = process.env.DEMO_EMAIL || "demo@p360.com";

  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`[seed] La BD ya tiene ${existing} usuario(s) — no se siembra nada.`);
    return;
  }

  await prisma.user.create({
    data: {
      name: "Usuario Demo",
      email,
      password: security.hashPassword(password), // hash PBKDF2, nunca texto plano
      credits: 50,
      plan: "starter",
    },
  });
  console.log(`[seed] Usuario demo creado: ${email} (contraseña hasheada PBKDF2, tomada de DEMO_PASSWORD).`);
}

main()
  .catch((e: unknown) => {
    console.error("[seed] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
