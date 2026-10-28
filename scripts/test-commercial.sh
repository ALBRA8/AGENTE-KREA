#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# BLOQUE 7: Módulos comerciales AGENTE-KREA (generación real)
# ═══════════════════════════════════════════════════════════════
BASE="http://localhost:3000"
PASS=0; FAIL=0
RESULTS=()

check() {
  local id="$1" expected="$2" actual="$3" note="$4"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS+1)); RESULTS+=("✅ $id  [$actual] $note")
  else
    FAIL=$((FAIL+1)); RESULTS+=("❌ $id  [esperado $expected, obtuvo $actual] $note")
  fi
}

TOKEN=$(cat /tmp/krea-token.txt 2>/dev/null || curl -s -X POST $BASE/api/auth/auto-login | jq -r '.id')

echo "── 7.1 Plantillas ──"
R=$(curl -s -w "\n%{http_code}" $BASE/api/commercial/templates --max-time 20)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
NTPL=$(echo "$BODY" | jq '[.templates // .data // []] | length' 2>/dev/null)
check "GET /api/commercial/templates" 200 "$CODE" "plantillas=$NTPL"

echo "── 7.2 Logo (2 variantes) ──"
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/api/commercial/logo -H "Content-Type: application/json" \
  -d '{"brandName":"KREA Test","tagline":"Creatividad sin límites","industry":"tecnología","style":"iconic","variants":["primary","icon-only"],"language":"es"}' \
  --max-time 240)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
OK=$(echo "$BODY" | jq '.success' 2>/dev/null)
NVAR=$(echo "$BODY" | jq '[.data.variants // []] | length' 2>/dev/null)
check "POST /api/commercial/logo" 200 "$CODE" "success=$OK variantes=$NVAR"

echo "── 7.3 Banner ──"
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/api/commercial/banner -H "Content-Type: application/json" \
  -d '{"productInfo":"Auriculares inalámbricos KREA Sound con cancelación de ruido, 30h de batería, precio 99€","bannerFormat":"square_1080","headline":"Escucha lo imposible","cta":"Comprar ahora","language":"es"}' \
  --max-time 120)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
OK=$(echo "$BODY" | jq '.success' 2>/dev/null)
check "POST /api/commercial/banner" 200 "$CODE" "success=$OK"

echo "── 7.4 Email ──"
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/api/commercial/email -H "Content-Type: application/json" \
  -d '{"productInfo":{"name":"Curso Marketing Digital","description":"Curso online de marketing digital, 8 semanas, certificado incluido","price":"149€"},"creativeType":"promo-block","headline":"Domina el marketing en 8 semanas","cta":"Inscríbete hoy","language":"es"}' \
  --max-time 240)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
OK=$(echo "$BODY" | jq '.success' 2>/dev/null)
check "POST /api/commercial/email" 200 "$CODE" "success=$OK"

echo "── 7.5 Catálogo ──"
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/api/commercial/catalog -H "Content-Type: application/json" \
  -d '{"products":[{"name":"Camiseta Premium","price":"29.99","description":"Algodón orgánico"},{"name":"Gorra Classic","price":"19.99","description":"Ajustable unisex"}],"catalogFormat":"digital-catalog","title":"Colección Verano","language":"es"}' \
  --max-time 240)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
OK=$(echo "$BODY" | jq '.success' 2>/dev/null)
check "POST /api/commercial/catalog" 200 "$CODE" "success=$OK"

echo "── 7.6 Edición NL (imagen de prueba 2x2 px base64) ──"
# 1x1 red PNG válida en base64
IMG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/api/commercial/edit -H "Content-Type: application/json" \
  -d "{\"originalImage\":\"data:image/png;base64,$IMG\",\"editInstruction\":\"Convierte el fondo en un atardecer dorado\",\"language\":\"es\"}" \
  --max-time 120)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
OK=$(echo "$BODY" | jq '.success' 2>/dev/null)
check "POST /api/commercial/edit" 200 "$CODE" "success=$OK"

echo "── 7.7 Batch (3 items mixtos) ──"
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/api/commercial/batch -H "Content-Type: application/json" \
  -d '{"items":[{"type":"logo","params":{"brandName":"Batch Brand A","style":"iconic"}},{"type":"logo","params":{"brandName":"Batch Brand B","style":"wordmark"}},{"type":"email","params":{"productInfo":{"name":"Pack Cafés Especiales","description":"Cafés de especialidad 1kg tostado medio"},"creativeType":"header"}}],"concurrency":3}' \
  --max-time 400)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
NTOTAL=$(echo "$BODY" | jq '.data.progress.total // 0' 2>/dev/null)
NSUCC=$(echo "$BODY" | jq '.data.totalAssets // 0' 2>/dev/null)
NFAIL=$(echo "$BODY" | jq '.data.progress.failed // 0' 2>/dev/null)
check "POST /api/commercial/batch" 200 "$CODE" "total=$NTOTAL exitosos=$NSUCC fallidos=$NFAIL"

echo ""
echo "────────── RESULTADOS BLOQUE 7 ──────────"
for r in "${RESULTS[@]}"; do echo "$r"; done
echo ""
echo "BLOQUE 7: $PASS pasados, $FAIL fallidos"
