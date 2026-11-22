#!/bin/bash
# Smoke dedicado a /api/commercial/export (P4) — ruta HTTP real contra servidor
# de producción. Verifica los 3 estados de honestidad:
#   - shopify sin credenciales → NOT_VERIFIED_NO_CREDENTIALS + env vars faltantes
#   - funnelish                → NOT_SUPPORTED_NO_PUBLIC_API (por diseño)
#   - validación de formato    → success=false con error de plataforma
set -u
cd /home/z/my-project
BASE=http://localhost:3000
OUT=download/evidencia-export-ecom
mkdir -p "$OUT"
STAMP=$(date +%s)
EMAIL="smokeexp${STAMP}@krea.local"

REG=$(curl -s -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Export\",\"email\":\"$EMAIL\",\"password\":\"smoke-test-123456\"}")
TOKEN=$(echo "$REG" | jq -r '.token // empty')
[ -z "$TOKEN" ] && { echo "FATAL: sin token"; exit 2; }
EMAILQ=$(echo "$EMAIL" | sed "s/'/''/g")
echo "UPDATE \"User\" SET credits = 50 WHERE email = '$EMAILQ';" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>/dev/null

PASS=0; FAIL=0

# 1) shopify sin credenciales en env → prepared-only honesto
TMP1=$(mktemp)
M1=$(curl -s -o "$TMP1" -w '%{http_code}' -X POST "$BASE/api/commercial/export" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"platform":"shopify","productData":{"id":"prod-smoke-exp","name":"Café Krea","price":18},"creatives":[{"type":"image","url":"https://cdn.krea.test/creativo.jpg","alt":"Café"}]}' \
  --max-time 60)
H1=$(jq -r '.honesty.realHttpSend // "sin-honesty"' "$TMP1")
MISS=$(jq -c '.data.credentials.missingEnvVars // []' "$TMP1")
if [ "$M1" = "200" ] && [ "$H1" = "NOT_VERIFIED_NO_CREDENTIALS" ]; then
  echo "export shopify (sin credenciales) | HTTP $M1 | honesty=$H1 missing=$MISS | OK"
  PASS=$((PASS+1))
else
  echo "export shopify (sin credenciales) | HTTP $M1 | honesty=$H1 | FAIL"
  FAIL=$((FAIL+1))
fi
mv "$TMP1" "$OUT/smoke-ruta-shopify-sin-credenciales.json"

# 2) funnelish → NOT_SUPPORTED_NO_PUBLIC_API (por diseño)
TMP2=$(mktemp)
M2=$(curl -s -o "$TMP2" -w '%{http_code}' -X POST "$BASE/api/commercial/export" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"platform":"funnelish","productData":{"id":"prod-smoke-exp","name":"Café Krea","price":18},"creatives":[{"type":"image","url":"https://cdn.krea.test/creativo.jpg","alt":"Café"}]}' \
  --max-time 60)
H2=$(jq -r '.honesty.realHttpSend // "sin-honesty"' "$TMP2")
if [ "$M2" = "200" ] && [ "$H2" = "NOT_SUPPORTED_NO_PUBLIC_API" ]; then
  echo "export funnelish               | HTTP $M2 | honesty=$H2 | OK"
  PASS=$((PASS+1))
else
  echo "export funnelish               | HTTP $M2 | honesty=$H2 | FAIL"
  FAIL=$((FAIL+1))
fi
mv "$TMP2" "$OUT/smoke-ruta-funnelish.json"

# 3) formato no aceptado → rechazo honesto de la plataforma
TMP3=$(mktemp)
M3=$(curl -s -o "$TMP3" -w '%{http_code}' -X POST "$BASE/api/commercial/export" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"platform":"shopify","productData":{"id":"prod-smoke-exp","name":"Café Krea","price":18},"creatives":[{"type":"image","url":"https://cdn.krea.test/foto.tiff","format":"tiff"}]}' \
  --max-time 60)
S3=$(jq -r '.success' "$TMP3")
E3=$(jq -r '.data.errors[0] // empty' "$TMP3")
if [ "$M3" = "200" ] && [ "$S3" = "false" ] && echo "$E3" | grep -q "tiff"; then
  echo "export formato tiff            | HTTP $M3 | success=$S3 error=$E3 | OK"
  PASS=$((PASS+1))
else
  echo "export formato tiff            | HTTP $M3 | success=$S3 error=$E3 | FAIL"
  FAIL=$((FAIL+1))
fi
mv "$TMP3" "$OUT/smoke-ruta-formato-rechazado.json"

echo "RESUMEN export ruta: OK=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] && [ "$PASS" = "3" ] && exit 0 || exit 1
