#!/bin/bash
# P6 — Smoke del orquestador vía HTTP: dossier → produce (ejecución síncrona real)
set -u
cd /home/z/my-project
BASE=http://localhost:3000
STAMP=$(date +%s)
EMAIL="smokep6${STAMP}@krea.local"
REG=$(curl -s -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke P6\",\"email\":\"$EMAIL\",\"password\":\"smoke-test-123456\"}")
TOKEN=$(echo "$REG" | jq -r '.token // empty')
[ -z "$TOKEN" ] && { echo "FATAL: sin token"; exit 2; }

# 1. Crear dossier
DOSSIER=$(curl -s -X POST "$BASE/api/product/dossiers" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"productName":"Guia rapida de ventas por WhatsApp","productType":"ebook"}')
DID=$(echo "$DOSSIER" | jq -r '.id // empty')
[ -z "$DID" ] && { echo "FATAL: sin dossier: $DOSSIER"; exit 2; }
echo "[p6] dossier: $DID"

# 2. POST /api/product/produce → ejecuta la fábrica sincrónicamente
TMP=$(mktemp)
M=$(curl -s -o "$TMP" -w '%{http_code} %{time_total}' -X POST "$BASE/api/product/produce" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d "{\"dossierId\":\"$DID\"}" --max-time 900)
echo "[p6] HTTP/latencia: $M"
jq -c '{status, currentStep, execution: (.execution | {executionId, factoryType, status, artifacts: (.artifacts | length), error})}' "$TMP" 2>/dev/null || head -c 400 "$TMP"
mv "$TMP" download/evidencia-smoke-commercial/p6-produce.json

# 3. Estado del dossier tras la ejecución
curl -s "$BASE/api/product/dossiers/$DID" -H "Authorization: Bearer $TOKEN" \
  | jq -c '{status: .status // .dossier.status, artifacts: ((.artifacts // .dossier.artifacts // "[]") | if type=="string" then (fromjson | length) else length end)}' 2>/dev/null || true
