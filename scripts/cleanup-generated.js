#!/usr/bin/env node
/**
 * cleanup-generated.js — política de limpieza de archivos generados
 *
 * Reglas:
 *  1. Elimina archivos de public/generated que NO tienen registro en la tabla
 *     Generation (huérfanos: escrituras interrumpidas, errores post-escritura).
 *  2. Elimina archivos cuya Generation asociada es más antigua que RETENTION_DAYS.
 *
 * Uso:
 *   npm run cleanup:generated            # aplica
 *   npm run cleanup:generated -- --dry-run   # solo lista lo que borraría
 *
 * NOTA DE DESPLIEGUE: en plataformas con filesystem efímero (Vercel, contenedores
 * sin volumen), public/generated se pierde en cada redeploy. Para producción
 * sirve los archivos desde un storage persistente (S3/R2/volumen) y guarda en
 * Generation.result la URL absoluta del objeto.
 */
const fs = require("fs");
const path = require("path");

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");
const RETENTION_DAYS = process.env.GENERATED_RETENTION_DAYS
  ? parseInt(process.env.GENERATED_RETENTION_DAYS, 10)
  : 30;
const DRY_RUN = process.argv.includes("--dry-run");

// Prisma Client sin necesidad de TS: el cliente generado está en node_modules
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  if (!fs.existsSync(GENERATED_DIR)) {
    console.log("[cleanup] No existe public/generated — nada que hacer.");
    return;
  }

  const files = fs.readdirSync(GENERATED_DIR).filter((f) => !f.startsWith("."));
  console.log(`[cleanup] ${files.length} archivos en public/generated (retención: ${RETENTION_DAYS} días${DRY_RUN ? ", DRY-RUN" : ""})`);

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Rutas registradas en Generation (formato /generated/<nombre>)
  const gens = await db.generation.findMany({
    where: { result: { startsWith: "/generated/" } },
    select: { result: true, createdAt: true },
  });
  const byName = new Map(gens.map((g) => [g.result.replace("/generated/", ""), g.createdAt]));

  let removed = 0;
  let kept = 0;
  for (const file of files) {
    const createdAt = byName.get(file);
    const fullPath = path.join(GENERATED_DIR, file);

    let reason = null;
    if (!createdAt) {
      reason = "huérfano (sin registro Generation)";
    } else if (new Date(createdAt) < cutoff) {
      reason = `retención vencida (creado ${createdAt.toISOString().slice(0, 10)})`;
    }

    if (reason) {
      if (DRY_RUN) {
        console.log(`  [DRY] borraría ${file} — ${reason}`);
      } else {
        try {
          fs.unlinkSync(fullPath);
          console.log(`  ✗ borrado ${file} — ${reason}`);
        } catch (e) {
          console.error(`  ⚠ no se pudo borrar ${file}: ${e.message}`);
          kept++;
          continue;
        }
      }
      removed++;
    } else {
      kept++;
    }
  }

  console.log(`[cleanup] Resumen: ${removed} marcados para borrado, ${kept} conservados.`);
}

main()
  .catch((e) => {
    console.error("[cleanup] ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
