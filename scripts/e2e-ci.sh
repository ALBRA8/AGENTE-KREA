#!/usr/bin/env bash
# E2E de CI: servidor de producción levantado + proveedor IA MOCKEADO.
#
# FASE 0.5 del informe: `test:e2e` ya no es un "echo + exit 0". Este script:
#   1. Prepara una BD de test limpia.
#   2. Arranca el servidor de producción (next start) en :3123.
#   3. Verifica /api/health.
#   4. Ejecuta scripts/e2e-mission-flow.ts con KREA_E2E_MOCK=1 (proveedor
#      determinista inyectado en el registry — no llama a la red).
#   5. Detiene el servidor; exit != 0 si cualquier paso falla.
#
# Uso: npm run test:e2e   (requiere `npm run build` previo)
set -euo pipefail
cd "$(dirname "$0")/.."

export DATABASE_URL="file:$(pwd)/db/e2e-test.db"
export KREA_E2E_MOCK=1
export PORT=3123

echo "── [e2e-ci] BD de test: $DATABASE_URL"
rm -f db/e2e-test.db
npx prisma db push --skip-generate >/dev/null

echo "── [e2e-ci] Arrancando servidor de producción en :3123"
npx next start -p 3123 > /tmp/e2e-server.log 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 60); do
  if curl -sf http://localhost:3123/api/health > /dev/null 2>&1; then
    echo "── [e2e-ci] /api/health OK (intento $i)"
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "── [e2e-ci] FALLO: el servidor murió al arrancar. Log:"
    tail -20 /tmp/e2e-server.log
    exit 1
  fi
  sleep 1
done
curl -sf http://localhost:3123/api/health > /dev/null || { echo "── [e2e-ci] FALLO: health no respondió"; exit 1; }

echo "── [e2e-ci] Ejecutando flujo de misión E2E (proveedor mockeado)"
npx tsx scripts/e2e-mission-flow.ts
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  echo "── [e2e-ci] FALLO: e2e-mission-flow exit=$STATUS"
  exit "$STATUS"
fi
echo "── [e2e-ci] E2E COMPLETO: servidor + proveedor mockeado + flujo de misión OK"
