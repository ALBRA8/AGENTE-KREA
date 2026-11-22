#!/bin/bash
# Smoke de UNA sola ruta: launch-pack (verificación del fix buildLaunchBatch)
set -u
cd /home/z/my-project
BASE=http://localhost:3000
STAMP=$(date +%s)
EMAIL="smokelp${STAMP}@krea.local"
REG=$(curl -s -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke LP\",\"email\":\"$EMAIL\",\"password\":\"smoke-test-123456\"}")
TOKEN=$(echo "$REG" | jq -r '.token // empty')
[ -z "$TOKEN" ] && TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"smoke-test-123456\"}" | jq -r '.token // empty')
[ -z "$TOKEN" ] && { echo "FATAL: sin token"; exit 2; }
echo "UPDATE \"User\" SET credits = 500 WHERE email = '$EMAIL';" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>/dev/null

PROD='{"name":"Café Krea","description":"Café de especialidad tostado artesanalmente en lotes pequeños","price":"$18","category":"food","benefits":["Sabor intenso"],"differentiators":["Grano único"]}'
TMP=$(mktemp)
M=$(curl -s -o "$TMP" -w '%{http_code} %{time_total}' -X POST "$BASE/api/commercial/launch-pack" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d "{\"productInfo\":$PROD,\"platforms\":[\"meta\"],\"sections\":[\"hero\"],\"mockupTypes\":[\"phone\"],\"adFormats\":[\"feed\"],\"concurrency\":1}" \
  --max-time 600)
echo "HTTP/latencia: $M"
jq -c '{success, progress: {total: .data.progress.total, completed: .data.progress.completed, failed: .data.progress.failed}, items: [.data.progress.items[] | {type, status, innerSuccess: (.result.success // "n/a"), hasImage: ((.result.imageBase64 // "") | length > 100)}]}' "$TMP"
mv "$TMP" download/evidencia-smoke-commercial/launch-pack-fix.json
