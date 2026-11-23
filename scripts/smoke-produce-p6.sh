#!/bin/bash
# P6 — Smoke del orquestador vía HTTP (FASE 2, modo ASYNC):
# dossier → produce responde 202 con executionId → polling GET hasta QA/FAILED.
set -u
cd /home/z/my-project
BASE=http://localhost:3000
OUT=download/evidencia-smoke-commercial
mkdir -p "$OUT"
STAMP=$(date +%s)
EMAIL="smokep6${STAMP}@krea.local"
REG=$(curl -s -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke P6\",\"email\":\"$EMAIL\",\"password\":\"smoke-test-123456\"}")
TOKEN=$(echo "$REG" | jq -r '.token // empty')
[ -z "$TOKEN" ] && { echo "FATAL: sin token"; exit 2; }
# Créditos para el cobro de product:produce (12)
EMAILQ=$(echo "$EMAIL" | sed "s/'/''/g")
echo "UPDATE \"User\" SET credits = 50 WHERE email = '$EMAILQ';" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>/dev/null

# 1. Crear dossier
DOSSIER=$(curl -s -X POST "$BASE/api/product/dossiers" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"productName":"Guia rapida de ventas por WhatsApp","productType":"ebook"}')
DID=$(echo "$DOSSIER" | jq -r '.id // empty')
[ -z "$DID" ] && { echo "FATAL: sin dossier: $DOSSIER"; exit 2; }
echo "[p6] dossier: $DID"

# 2. POST /api/product/produce → 202 inmediato con executionId
TMP=$(mktemp)
M=$(curl -s -o "$TMP" -w '%{http_code} %{time_total}' -X POST "$BASE/api/product/produce" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d "{\"dossierId\":\"$DID\"}" --max-time 60)
echo "[p6] HTTP/latencia del 202: $M"
jq -c '{status, mode, executionId, poll, credits}' "$TMP" 2>/dev/null || head -c 400 "$TMP"
EXECID=$(jq -r '.executionId // empty' "$TMP")
mv "$TMP" download/evidencia-smoke-commercial/p6-produce-202.json
[ -z "$EXECID" ] && { echo "FATAL: sin executionId en el 202"; exit 2; }

# 3. Polling GET /api/product/factory/[executionId] hasta estado final
FINAL=""
for i in $(seq 1 120); do
  STATUS=$(curl -s "$BASE/api/product/factory/$EXECID" -H "Authorization: Bearer $TOKEN" | jq -r '.status // empty')
  case "$STATUS" in
    COMPLETED|PASSED|FAILED|CANCELLED)
      echo "[p6] ejecución terminó en $STATUS tras ${i}x5s"
      curl -s "$BASE/api/product/factory/$EXECID" -H "Authorization: Bearer $TOKEN" > download/evidencia-smoke-commercial/p6-produce-final.json
      FINAL="$STATUS"; break ;;
  esac
  sleep 5
done
[ -z "$FINAL" ] && { echo "FATAL: la ejecución no terminó a tiempo"; exit 1; }

# 4. Estado del dossier tras la ejecución
curl -s "$BASE/api/product/dossiers/$DID" -H "Authorization: Bearer $TOKEN" \
  | jq -c '{status: .status // .dossier.status, artifacts: ((.artifacts // .dossier.artifacts // "[]") | if type=="string" then (fromjson | length) else length end)}' 2>/dev/null || true

[ "$FINAL" = "COMPLETED" ] || [ "$FINAL" = "PASSED" ] && exit 0 || exit 1
