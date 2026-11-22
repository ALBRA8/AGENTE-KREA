#!/bin/bash
# SMOKE REAL por cada /api/commercial/* — P2 del INFORME-ESTADO.md
# Registra un usuario de prueba, sube sus créditos (solo el usuario smoke, BD dev),
# llama cada ruta con payload mínimo y proveedor REAL, y registra evidencia por ruta.
# Salida: download/evidencia-smoke-commercial/<ruta>.json + resumen en stdout.
set -u
cd /home/z/my-project

BASE=http://localhost:3000
OUT=download/evidencia-smoke-commercial
mkdir -p "$OUT"
STAMP=$(date +%s)
EMAIL="smoke${STAMP}@krea.local"
PASS="smoke-test-123456"

# 1. Registrar usuario smoke (50 créditos iniciales)
REG=$(curl -s -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke E2E\",\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$REG" | jq -r '.token // empty')
if [ -z "$TOKEN" ]; then
  # usuario ya existente → login
  TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r '.token // empty')
fi
if [ -z "$TOKEN" ]; then
  echo "FATAL: no se obtuvo token: $REG"; exit 2
fi
echo "[auth] usuario smoke: $EMAIL"

# 2. Top-up de créditos SOLO para el usuario smoke (BD dev, documentado)
echo "UPDATE \"User\" SET credits = 500 WHERE email = '$EMAIL';" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>/dev/null \
  && echo "[credits] top-up 500 para el usuario smoke" || echo "[credits] AVISO: top-up falló (el registro da 50)"

# 3. Imagen de prueba real (fixture PNG) como data URL
B64=$(base64 -w0 src/lib/__tests__/fixtures/tiny.png)
IMG="data:image/png;base64,$B64"
PROD='{"name":"Café Krea","description":"Café de especialidad tostado artesanalmente en lotes pequeños","price":"$18","category":"food","benefits":["Sabor intenso","Tostado fresco"],"differentiators":["Grano único","Comercio directo"]}'

# 4. Smoke por ruta: NAME|METHOD|PATH|DATA|CAPABILITY
PASS_N=0; FAIL_N=0
run_one() {
  NAME="$1"; METHOD="$2"; PATH_="$3"; DATA="$4"
  TMP=$(mktemp)
  METRIC=$(curl -s -o "$TMP" -w '%{http_code} %{time_total}' -X "$METHOD" "$BASE$PATH_" \
    -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
    ${DATA:+-d "$DATA"} --max-time 600)
  CODE=$(echo "$METRIC" | cut -d' ' -f1)
  SECS=$(echo "$METRIC" | cut -d' ' -f2)
  BYTES=$(wc -c < "$TMP")
  mv "$TMP" "$OUT/$NAME.json"
  SUCCESS=$(jq -r '.success // "no-field"' "$OUT/$NAME.json" 2>/dev/null)
  CRED=$(jq -r '.credits // "-"' "$OUT/$NAME.json" 2>/dev/null)
  ERR=$(jq -r '.error // "-"' "$OUT/$NAME.json" 2>/dev/null | cut -c1-80)
  HONESTY=$(jq -r '.data.honesty.realHttpSend // .data.honesty // "-"' "$OUT/$NAME.json" 2>/dev/null | cut -c1-40)
  if [ "$CODE" = "200" ] && [ "$SUCCESS" = "true" ]; then
    PASS_N=$((PASS_N+1)); VERDICT="OK"
  else
    FAIL_N=$((FAIL_N+1)); VERDICT="FAIL"
  fi
  printf '%-14s | HTTP %s | %6.1fs | %8d B | success=%s | credits=%s | honesty=%s | err=%s | %s\n' \
    "$NAME" "$CODE" "$SECS" "$BYTES" "$SUCCESS" "$CRED" "$HONESTY" "$ERR" "$VERDICT" | tee -a "$OUT/resumen.txt"
  sleep 3  # espaciado: el proveedor limita ráfagas (429, ver P2)
}

echo "ruta          | codigo    | latencia | respuesta | resultado  | saldo     | honestidad        | error" | tee "$OUT/resumen.txt"
run_one templates GET  "/api/commercial/templates" ""
run_one logo     POST "/api/commercial/logo"     '{"brandName":"Café Krea","tagline":"Café de especialidad","industry":"food","mood":"premium","variants":1}'
run_one banner   POST "/api/commercial/banner"   "{\"productInfo\":$PROD,\"bannerFormat\":\"email-header\",\"headline\":\"Café recién tostado\"}"
run_one email    POST "/api/commercial/email"    "{\"productInfo\":$PROD,\"creativeType\":\"header\",\"headline\":\"Lanzamiento: Café Krea\"}"
run_one catalog  POST "/api/commercial/catalog"  "{\"products\":[$PROD],\"catalogFormat\":\"single-page-flyer\",\"title\":\"Catálogo Café Krea\"}"
run_one ad       POST "/api/commercial/ad"       "{\"platform\":\"meta\",\"format\":\"feed\",\"productInfo\":$PROD}"
run_one landing  POST "/api/commercial/landing"  "{\"sectionType\":\"hero\",\"productInfo\":$PROD}"
run_one mockup   POST "/api/commercial/mockup"   "{\"productImage\":\"$IMG\",\"mockupType\":\"tshirt\",\"style\":\"fondo blanco minimalista\"}"
run_one edit     POST "/api/commercial/edit"     "{\"originalImage\":\"$IMG\",\"editInstruction\":\"cambia el fondo a azul con degradado suave\"}"
run_one variants POST "/api/commercial/variants" "{\"baseAd\":{\"platform\":\"meta\",\"adFormat\":\"feed\",\"productInfo\":$PROD},\"angles\":[\"price\",\"emotion\"],\"count\":1}"
run_one batch    POST "/api/commercial/batch"    "{\"items\":[{\"type\":\"logo\",\"params\":{\"brandName\":\"Batch Krea\"}}],\"concurrency\":1}"
run_one launch-pack POST "/api/commercial/launch-pack" "{\"productInfo\":$PROD,\"platforms\":[\"meta\"],\"sections\":[\"hero\"],\"mockupTypes\":[\"phone\"],\"adFormats\":[\"feed\"],\"concurrency\":1}"
run_one export   POST "/api/commercial/export"   "{\"platform\":\"shopify\",\"productData\":{\"id\":\"prod-smoke-123\",\"name\":\"Café Krea\",\"description\":\"Café de especialidad\",\"price\":18},\"creatives\":[{\"type\":\"image\",\"url\":\"$IMG\",\"alt\":\"Café Krea\"}]}"

echo ""
echo "=== RESUMEN SMOKE /api/commercial/* ===" | tee -a "$OUT/resumen.txt"
echo "OK: $PASS_N  FAIL: $FAIL_N  (evidencia JSON en $OUT/)" | tee -a "$OUT/resumen.txt"
# Saldo final del usuario smoke (evidencia de cobro neto)
FINAL=$(curl -s "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN")
echo "saldo final usuario smoke: $(echo "$FINAL" | jq -c '.user // .')" | tee -a "$OUT/resumen.txt"
[ "$FAIL_N" = "0" ] && exit 0 || exit 1
