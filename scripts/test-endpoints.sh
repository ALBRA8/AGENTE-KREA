#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# PRUEBA GENERAL DE ENDPOINTS — KREA (AGENTE-KREA Commercial) v2
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

jqget() { echo "$1" | jq -r "$2" 2>/dev/null; }

echo "════════════════════════════════════════════"
echo " BLOQUE 1: Salud y núcleo"
echo "════════════════════════════════════════════"
R=$(curl -s -w "\n%{http_code}" $BASE/api/health --max-time 15)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
check "GET /api/health" 200 "$CODE" "status=$(jqget "$BODY" '.status')"

R=$(curl -s -w "\n%{http_code}" $BASE/api/commercial --max-time 15)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
NCAP=$(echo "$BODY" | jq '[.capabilities // []] | length' 2>/dev/null)
check "GET /api/commercial (índice)" 200 "$CODE" "capacidades=$NCAP"

echo ""
echo "════════════════════════════════════════════"
echo " BLOQUE 2: Seguridad (middleware)"
echo "════════════════════════════════════════════"
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/harness --max-time 15)
check "GET /api/harness sin token → 401" 401 "$CODE" ""

CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/doctor --max-time 15)
check "GET /api/doctor sin token → 401" 401 "$CODE" ""

CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/auth/me --max-time 15)
check "GET /api/auth/me sin token → 401" 401 "$CODE" ""

# Security headers (curl emite headers en minúsculas → rg -i)
HDRS=$(curl -s -D - -o /dev/null $BASE/api/health --max-time 15)
for h in "x-frame-options: DENY" "x-content-type-options: nosniff" "referrer-policy: strict-origin-when-cross-origin" "permissions-policy: camera="; do
  if echo "$HDRS" | rg -qi "$h"; then PASS=$((PASS+1)); RESULTS+=("✅ header '$h' presente"); else FAIL=$((FAIL+1)); RESULTS+=("❌ header '$h' FALTA"); fi
done

echo ""
echo "════════════════════════════════════════════"
echo " BLOQUE 3: Autenticación"
echo "════════════════════════════════════════════"
R=$(curl -s -w "\n%{http_code}" -X POST $BASE/api/auth/auto-login --max-time 25)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
TOKEN=$(jqget "$BODY" ".token")
check "POST /api/auth/auto-login" 200 "$CODE" "user=$(jqget "$BODY" '.user.name')"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"demo@p360.com","password":"contraseñaincorrecta"}' --max-time 20)
check "POST /api/auth/login (pass incorrecta → 401)" 401 "$CODE" ""

R=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"demo@p360.com","password":"test-krea-2026"}' --max-time 20)
R2=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"demo@p360.com","password":"demo123"}' --max-time 20)
if [ "$R" = "200" ] || [ "$R2" = "200" ]; then
  PASS=$((PASS+1)); RESULTS+=("✅ POST /api/auth/login (credenciales válidas) [200]")
else
  FAIL=$((FAIL+1)); RESULTS+=("❌ POST /api/auth/login [esperado 200, obtuvo $R/$R2]")
fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/auth/me -H "Authorization: Bearer $TOKEN" --max-time 15)
check "GET /api/auth/me con token" 200 "$CODE" ""

echo ""
echo "════════════════════════════════════════════"
echo " BLOQUE 4: Rutas protegidas con token"
echo "════════════════════════════════════════════"
R=$(curl -s -w "\n%{http_code}" $BASE/api/harness -H "Authorization: Bearer $TOKEN" --max-time 20)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
check "GET /api/harness con token" 200 "$CODE" ""

R=$(curl -s -w "\n%{http_code}" $BASE/api/doctor -H "Authorization: Bearer $TOKEN" --max-time 30)
CODE=$(echo "$R" | tail -1)
check "GET /api/doctor con token" 200 "$CODE" ""

R=$(curl -s -w "\n%{http_code}" "$BASE/api/generations" -H "Authorization: Bearer $TOKEN" --max-time 15)
CODE=$(echo "$R" | tail -1)
check "GET /api/generations con token" 200 "$CODE" ""

R=$(curl -s -w "\n%{http_code}" "$BASE/api/metrics" -H "Authorization: Bearer $TOKEN" --max-time 15)
CODE=$(echo "$R" | tail -1)
check "GET /api/metrics con token" 200 "$CODE" ""

echo ""
echo "════════════════════════════════════════════"
echo " BLOQUE 5: Sistema ADN"
echo "════════════════════════════════════════════"
for ep in capabilities identity skills tools memory mission; do
  R=$(curl -s -w "\n%{http_code}" $BASE/api/adn/$ep --max-time 20)
  CODE=$(echo "$R" | tail -1)
  check "GET /api/adn/$ep" 200 "$CODE" ""
done
# Rutas ADN protegidas
for ep in observability security/audit; do
  R=$(curl -s -w "\n%{http_code}" $BASE/api/adn/$ep -H "Authorization: Bearer $TOKEN" --max-time 20)
  CODE=$(echo "$R" | tail -1)
  check "GET /api/adn/$ep (con token)" 200 "$CODE" ""
done
# Doctor ADN — debe ser 200 (HEALTHY o DEGRADED) tras fix de umbral heap
R=$(curl -s -w "\n%{http_code}" $BASE/api/adn/doctor --max-time 30)
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
OV=$(jqget "$BODY" ".overallStatus")
check "GET /api/adn/doctor (sin 503)" 200 "$CODE" "overall=$OV"

echo ""
echo "════════════════════════════════════════════"
echo " BLOQUE 6: Validaciones comerciales (400)"
echo "════════════════════════════════════════════"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/commercial/logo -H "Content-Type: application/json" -d '{}' --max-time 15)
check "POST /api/commercial/logo sin brandName → 400" 400 "$CODE" ""

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/commercial/banner -H "Content-Type: application/json" -d '{}' --max-time 15)
check "POST /api/commercial/banner vacío → 400" 400 "$CODE" ""

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/commercial/email -H "Content-Type: application/json" -d '{}' --max-time 15)
check "POST /api/commercial/email vacío → 400" 400 "$CODE" ""

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/commercial/catalog -H "Content-Type: application/json" -d '{"products":[]}' --max-time 15)
check "POST /api/commercial/catalog sin formato → 400" 400 "$CODE" ""

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/commercial/edit -H "Content-Type: application/json" -d '{"originalImage":"x"}' --max-time 15)
check "POST /api/commercial/edit sin instrucción → 400" 400 "$CODE" ""

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/commercial/batch -H "Content-Type: application/json" -d '{"items":[]}' --max-time 15)
check "POST /api/commercial/batch sin items → 400" 400 "$CODE" ""

echo ""
echo "────────── RESULTADOS BLOQUES 1-6 ──────────"
for r in "${RESULTS[@]}"; do echo "$r"; done
echo ""
echo "TOTAL BLOQUES 1-6: $PASS pasados, $FAIL fallidos"
echo "$TOKEN" > /tmp/krea-token.txt
exit 0
