#!/bin/bash
# Sonda de memoria (FASE 2.3): ejecuta rutas comerciales y de producto en UN
# solo proceso de servidor, mide el RSS del next-server al inicio, en el medio
# y al final, y reporta el crecimiento. Evidencia: download/evidencia-fase2/
set -u
cd /home/z/my-project
BASE=http://localhost:3000
OUT=download/evidencia-fase2
mkdir -p "$OUT"

server_pid() {
  ss -ltnp 2>/dev/null | grep ':3000 ' | grep -oP '(?<=pid=)[0-9]+' | sort -u | head -1
}

rss_kb() {
  local pid="$1"
  [ -z "$pid" ] && { echo "0"; return; }
  grep VmRSS "/proc/$pid/status" 2>/dev/null | awk '{print $2}'
}

report() {
  local label="$1"; local pid="$2"
  local rss=$(rss_kb "$pid")
  if [ "$rss" = "0" ] || [ -z "$rss" ]; then
    echo "$label | PID=? | RSS=? (proceso no encontrado)"
  else
    echo "$label | PID=$pid | RSS=$((rss/1024)) MB"
  fi
  echo "$label $rss" >> "$OUT/rss-muestras.txt"
}

rm -f "$OUT/rss-muestras.txt"
PID=$(server_pid)
report "RSS_INICIO (tras warmup)" "$PID"

# warm-up (compila rutas)
curl -s -o /dev/null "$BASE/api/health" --max-time 10
curl -s -o /dev/null "$BASE/api/commercial/templates" --max-time 30
PID=$(server_pid); rm -f "$OUT/rss-muestras.txt"
report "RSS_BASELINE (tras warmup)" "$PID"

# Registro del usuario de prueba con créditos
STAMP=$(date +%s)
EMAIL="memprobe${STAMP}@krea.local"
REG=$(curl -s -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Memory Probe\",\"email\":\"$EMAIL\",\"password\":\"smoke-test-123456\"}")
TOKEN=$(echo "$REG" | jq -r '.token // empty')
[ -z "$TOKEN" ] && { echo "FATAL: sin token"; exit 2; }
EMAILQ=$(echo "$EMAIL" | sed "s/'/''/g")
echo "UPDATE \"User\" SET credits = 50 WHERE email = '$EMAILQ';" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>/dev/null

# ── Ronda 1: rutas ligeras repetidas (mismo proceso) ──
for i in 1 2 3 4 5 6 7 8; do
  curl -s -o /dev/null "$BASE/api/commercial/templates" -H "Authorization: Bearer $TOKEN" --max-time 30
  curl -s -o /dev/null -X POST "$BASE/api/commercial/export" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
    -d "{\"platform\":\"shopify\",\"productData\":{\"id\":\"mem-$i\",\"name\":\"Probe\",\"price\":1},\"creatives\":[]}" --max-time 30
  curl -s -o /dev/null "$BASE/api/health" --max-time 10
done
PID=$(server_pid)
report "RSS_TRAS_RONDA_LIGERA (24 requests ligeros)" "$PID"

# ── Ronda 2: generación IA real (logo + banner) + LLM (fit sobre oportunidad) ──
OPP=$(curl -s -X POST "$BASE/api/product/opportunities" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Sonda memoria ebook","description":"Ebook de prueba para la sonda de memoria del proceso","domain":"ebook","audience":"Testers","problem":"Medir RSS"}')
OPPID=$(echo "$OPP" | jq -r '.id // .data.id // empty')
if [ -n "$OPPID" ]; then
  curl -s -o /dev/null -X POST "$BASE/api/product/fit" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
    -d "{\"opportunityId\":\"$OPPID\"}" --max-time 120
fi
PROD='{"name":"Sonda Krea","description":"Producto de la sonda de memoria","price":"$9","category":"test"}'
curl -s -o /dev/null -X POST "$BASE/api/commercial/logo" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"brandName":"Sonda Krea","style":"minimalista"}' --max-time 180
curl -s -o /dev/null -X POST "$BASE/api/commercial/banner" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"productInfo":'"$PROD"',"format":"leaderboard"}' --max-time 180
PID=$(server_pid)
report "RSS_TRAS_GENERACION_IA (2 imágenes + 1 LLM)" "$PID"

# ── Ronda 3: otra ronda ligera para ver si el RSS vuelve a crecer sin carga IA ──
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null "$BASE/api/commercial/templates" -H "Authorization: Bearer $TOKEN" --max-time 30
  curl -s -o /dev/null "$BASE/api/health" --max-time 10
done
PID=$(server_pid)
report "RSS_TRAS_RONDA_FINAL (18 requests ligeros)" "$PID"

echo "---"
echo "Muestras crudas en $OUT/rss-muestras.txt (kB)"
