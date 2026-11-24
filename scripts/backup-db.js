#!/usr/bin/env node
/**
 * db:backup — copia segura de la BD SQLite usando el comando `.backup` de sqlite3
 * (seguro con la BD en caliente). Si el CLI sqlite3 no está disponible, copia el
 * archivo directamente y advierte que debe hacerse con la app detenida.
 *
 * Uso: npm run db:backup  →  db/backups/custom-<fecha>.db
 */
const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function resolveDbPath() {
  if (process.env.DATABASE_URL) {
    const m = process.env.DATABASE_URL.match(/^file:(.*)$/);
    if (m) return path.resolve(process.cwd(), m[1].replace(/^file:/, ""));
  }
  return path.join(process.cwd(), "db", "custom.db");
}

function main() {
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    console.error(`[db:backup] No existe la BD: ${dbPath}`);
    process.exit(1);
  }
  const outDir = path.join(path.dirname(dbPath), "backups");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.join(outDir, `${path.basename(dbPath, ".db")}-${stamp}.db`);

  try {
    execFileSync("sqlite3", [dbPath, `.backup '${out}'`], { stdio: "pipe" });
    console.log(`[db:backup] Copia segura (.backup de sqlite3): ${out}`);
  } catch {
    fs.copyFileSync(dbPath, out);
    console.warn(`[db:backup] sqlite3 CLI no disponible — copia directa de archivo.`);
    console.warn(`[db:backup] Si la app estaba escribiendo, verifica la copia: ${out}`);
  }
  const size = fs.statSync(out).size;
  console.log(`[db:backup] Tamaño: ${size} bytes`);
}

main();
