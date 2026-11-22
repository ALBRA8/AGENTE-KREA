#!/bin/bash
# Completar el smoke final: launch-pack + export (proceso fresco, memoria limpia)
set -u
cd /home/z/my-project
BASE=http://localhost:3000
STAMP=$(date +%s)
EMAIL="smokefin${STAMP}@krea.local"
REG=$(curl -s -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Final\",\"email\":\"$EMAIL\",\"password\":\"smoke-test-123456\"}")
TOKEN=$(echo "$REG" | jq -r '.token // empty')
[ -z "$TOKEN" ] && { echo "FATAL: sin token"; exit 2; }
EMAILQ=$(echo "$EMAIL" | sed "s/'/''/g")
echo "UPDATE \"User\" SET credits = 500 WHERE email = '$EMAILQ';" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>/dev/null

PROD='{"name":"Café Krea","description":"Café de especialidad tostado artesanalmente","price":"$18","category":"food"}'
IMG="data:image/png;base64,$(base64 -w0 src/lib/__tests__/fixtures/tiny.png)"

TMP=$(mktemp)
M=$(curl -s -o "$TMP" -w '%{http_code} %{time_total}' -X POST "$BASE/api/commercial/launch-pack" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d "{\"productInfo\":$PROD,\"platforms\":[\"meta\"],\"sections\":[\"hero\"],\"mockupTypes\":[\"phone\"],\"adFormats\":[\"feed\"],\"concurrency\":1}" \
  --max-time 900)
echo "launch-pack  | HTTP $M" | tee -a download/evidencia-smoke-commercial/resumen.txt
jq -c '{top: .success, completed: .data.progress.completed, failed: .data.progress.failed, items: [.data.progress.items[] | {type, status, inner: (.result.success // "n/a")}]}' "$TMP" | tee -a download/evidencia-smoke-commercial/resumen.txt
mv "$TMP" download/evidencia-smoke-commercial/launch-pack-final.json
sleep 3

TMP2=$(mktemp)
M2=$(curl -s -o "$TMP2" -w '%{http_code} %{time_total}' -X POST "$BASE/api/commercial/export" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d "{\"platform\":\"shopify\",\"productData\":{\"id\":\"prod-final\",\"name\":\"Café Krea\",\"description\":\"Café\",\"price\":18},\"creatives\":[{\"type\":\"image\",\"url\":\"$IMG\",\"alt\":\"Café\"}]}" \
  --max-time 120)
echo "export       | HTTP $M2" | tee -a download/evidencia-smoke-commercial/resumen.txt
jq -c '{top: .success, exported: .data.exportedAssets, honesty: .honesty.realHttpSend, credits: .credits}' "$TMP2" | tee -a download/evidencia-smoke-commercial/resumen.txt
mv "$TMP2" download/evidencia-smoke-commercial/export-final.json
