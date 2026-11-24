#!/bin/bash
# UI4 — Recorrido real en navegador (headless) SOLO desde la interfaz:
# registro → crear oportunidad → Evaluar fit (botón UI2) → Crear dossier
# (botón UI3, navega a Dossiers) → producir (202 + polling hasta QA desde la
# UI) → launch package (puente por API: sin botón UI en esta ronda) → verlo
# en la sección Launch (UI1). Capturas por paso + consola/errores.
set -u
cd /home/z/my-project
OUT=download/evidencia-ui4
mkdir -p "$OUT"
BASE=http://localhost:3000
STAMP=$(date +%s)
EMAIL="ui4walker${STAMP}@krea.local"
PASS="ui4-walker-123456"

say() { echo "[ui4] $(date +%H:%M:%S) $*"; }

# ref de un elemento accesible por su nombre visible (con reintentos)
ref_for() {
  local label="$1"
  for attempt in 1 2 3 4; do
    R=$(agent-browser snapshot -i 2>/dev/null | grep -F "$label" | grep -oE 'ref=(e[0-9]+)' | head -1 | grep -oE 'e[0-9]+')
    [ -n "$R" ] && { echo "$R"; return 0; }
    sleep 2
  done
  return 1
}

ref_first_textbox() {
  agent-browser snapshot -i 2>/dev/null | grep -E 'textbox' | grep -oE 'ref=(e[0-9]+)' | head -1 | grep -oE 'e[0-9]+'
}

# Click DOM real vía eval (los nav-buttons se re-renderizan y el click de
# Playwright a veces cae en un nodo desmontado)
click_button_text() {
  agent-browser eval "(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim().startsWith('$1')); if (b) { b.click(); return 'clicked'; } return 'not-found'; })()" 2>/dev/null | tail -1
}

click_ref() {
  if [ -z "$1" ]; then
    echo "[ui4] FATAL: ref vacío al hacer clic — snapshot:"
    agent-browser snapshot -i | head -25
    exit 4
  fi
  agent-browser click "@$1"
}
fill_ref() {
  if [ -z "$1" ]; then
    echo "[ui4] FATAL: ref vacío al rellenar — snapshot:"
    agent-browser snapshot -i | head -25
    exit 4
  fi
  agent-browser fill "@$1" "$2"
}

wait_health() {
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health" --max-time 3 2>/dev/null || true)
    [ "$code" = "200" ] && { echo "[ui4] servidor listo (intento $i)"; return 0; }
    sleep 2
  done
  return 2
}

# ── 0. Servidor (build de producción ya compilado) ──────────────────
nohup npm run start > /tmp/krea-server-ui4.log 2>&1 &
SRV_PID=$!
disown || true
wait_health || { echo "FATAL: servidor no respondió"; exit 2; }

# ── 1. Landing/auth ────────────────────────────────────────────────
agent-browser open "$BASE" --timeout 30000
sleep 2
agent-browser storage local clear
agent-browser cookies clear
agent-browser reload
sleep 3
agent-browser screenshot "$OUT/01-login.png"
say "captura 01-login"

# ── 2. Registro vía UI ─────────────────────────────────────────────
TAB=$(ref_for "Crear cuenta")
click_ref "$TAB"
sleep 1
NOMBRE=$(ref_for "Tu nombre")
EMAILBOX=$(ref_for "tu@email.com")
PASSBOX=$(ref_for "Mínimo 6 caracteres")
fill_ref "$NOMBRE" "Walker UI4"
fill_ref "$EMAILBOX" "$EMAIL"
fill_ref "$PASSBOX" "$PASS"
agent-browser screenshot "$OUT/02-registro-form.png"
SUBMIT=$(ref_for "Crear mi cuenta")
click_ref "$SUBMIT"
sleep 5
agent-browser screenshot "$OUT/03-app-tras-registro.png"
say "captura 03-app (registro por UI)"

# ── 3. Product Factory: crear oportunidad (UI) ─────────────────────
say "switch a Product Factory: $(click_button_text "Product Factory")"
sleep 3
NEWOPP=$(ref_for "Nueva Oportunidad")
click_ref "$NEWOPP"
sleep 1
T1=$(ref_for "Ej: Guía de Marketing Digital 2025")
T2=$(ref_for "Ej: Emprendedores digitales hispanohablantes")
T3=$(ref_first_textbox)
fill_ref "$T1" "Compost urbano en balcones pequeños"
fill_ref "$T2" "Habitantes de ciudad con balcón que quieren compostar sin olor"
fill_ref "$T3" "Búsquedas de compostaje urbano crecen; el olor y las plagas son la barrera número 1 en apartamentos pequeños"
agent-browser screenshot "$OUT/04-oportunidad-form.png"
say "crear oportunidad (UI)…"
EVAL=$(ref_for "Evaluar Oportunidad")
click_ref "$EVAL"
sleep 4
agent-browser screenshot "$OUT/05-oportunidad-creada.png"
say "captura 05-oportunidad-creada (tarjeta con botones Evaluar fit / Crear dossier)"

# ── 4. Evaluar fit (botón UI2, 2 créditos, LLM real) ───────────────
say "clic Evaluar fit: $(click_button_text "Evaluar fit")"
sleep 2
agent-browser screenshot "$OUT/06-fit-confirmacion-costo.png"
say "confirmación con costo visible — captura 06"
CONFIRM=$(ref_for "Confirmar")
click_ref "$CONFIRM"
say "esperando evaluación real del proveedor (~15-30s)…"
sleep 20
agent-browser screenshot "$OUT/07-fit-resultado.png"
FITTXT=$(agent-browser eval "(() => { const m = document.body.innerText.match(/Fit: (\\d+)%/); return m ? m[1] : 'no-match'; })()" 2>/dev/null | tail -1)
say "fit score visible en UI: ${FITTXT}%"

# ── 5. Crear dossier (botón UI3 → navega a Dossiers) ───────────────
say "clic Crear dossier: $(click_button_text "Crear dossier")"
sleep 2
agent-browser screenshot "$OUT/08-dossier-form-precargado.png"
say "formulario precargado — captura 08"
# el submit es el último botón "Crear dossier" visible (el opener desapareció)
agent-browser eval "(() => { const bs = Array.from(document.querySelectorAll('button')).filter(x => x.textContent.trim() === 'Crear dossier' && !x.disabled); if (bs.length) { bs[bs.length-1].click(); return 'clicked'; } return 'not-found'; })()" 2>/dev/null | tail -1
sleep 4
agent-browser screenshot "$OUT/09-dossiers-tras-crear.png"
say "captura 09-dossiers-tras-crear (sección Dossiers con el nuevo dossier)"

# ID del dossier leído del DETALLE renderizado por la UI (JSON completo)
DOSSIER_ID=$(agent-browser eval "(() => { const p = document.querySelector('pre'); if (!p) return ''; try { return JSON.parse(p.textContent).id || ''; } catch { return ''; } })()" 2>/dev/null | tail -1)
say "dossier (leído de la UI): $DOSSIER_ID"
[ -z "$DOSSIER_ID" ] && { echo "FATAL: no se pudo leer el dossier id desde la UI"; agent-browser console > "$OUT/console.txt" 2>&1; agent-browser errors > "$OUT/errores-pagina.txt" 2>&1; exit 3; }

# ── 5b. Puente por API (documentado): architect + specify ────────────
# produce exige specification con capítulos; architect/specify NO tienen
# botón UI en esta ronda (fuera del alcance UI1-UI3). Se invocan por API
# con el token de la sesión del navegador (LLM real, 2+2 créditos).
TOKEN=$(agent-browser storage local p360_token 2>/dev/null | tail -1 | awk '{print $NF}')
say "token de sesión: ${TOKEN:0:12}…"
# la oportunidad se lee de la relación del dossier (la UI no renderiza oppId)
OPPID=$(curl -s "$BASE/api/product/dossiers/$DOSSIER_ID" -H "Authorization: Bearer $TOKEN" | jq -r '.opportunityId // empty' 2>/dev/null)
say "oportunidad (del dossier, lectura API): $OPPID"
ARCH=$(curl -s -X POST "$BASE/api/product/architect" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"opportunityId":"'"$OPPID"'"}')
ARCH_EV=$(echo "$ARCH" | jq -r '.data.evidence // empty' 2>/dev/null)
say "architect evidence: ${ARCH_EV:-?}"
ARCH_DATA=$(echo "$ARCH" | jq -c '.data' 2>/dev/null)
SPEC=$(curl -s -X POST "$BASE/api/product/specify" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"dossierId":"'"$DOSSIER_ID"'","architecture":'"$ARCH_DATA"'}')
SPEC_EV=$(echo "$SPEC" | jq -r '.data.evidence // empty' 2>/dev/null)
SPEC_CH=$(echo "$SPEC" | jq -r '.data.chapters | length' 2>/dev/null)
say "specify evidence: ${SPEC_EV:-?} · capítulos: ${SPEC_CH:-?}"

# ── 6. Producción (UI): 202 async + polling hasta QA ────────────────
say "switch a sección Producción: $(click_button_text "Producción")"
sleep 2
say "abrir form producción: $(click_button_text "Nueva Producción")"
sleep 1
DIN=$(ref_for "Pega el ID del dossier aprobado...")
fill_ref "$DIN" "$DOSSIER_ID"
agent-browser screenshot "$OUT/10-produccion-form.png"
say "iniciar pipeline (202 async, 12 créditos)…"
START=$(ref_for "Iniciar Pipeline")
click_ref "$START"
sleep 5
agent-browser screenshot "$OUT/11-produccion-202-PRODUCING.png"
say "captura 11: job en PRODUCING (UI no bloquea)"

# Polling desde la UI: clic en el botón "Actualizar estado" de la tarjeta
say "polling hasta QA (pipeline real ~2-4 min)…"
FINAL_STATUS=""
for i in $(seq 1 25); do
  sleep 15
  agent-browser eval "(() => { const b = document.querySelector('button[title=\"Actualizar estado\"]'); if (b) b.click(); return b ? 'refreshed' : 'no-running'; })()" > /dev/null 2>&1
  ST=$(agent-browser eval "(() => { const badges = Array.from(document.querySelectorAll('span')).map(x => x.textContent.trim()); const found = badges.filter(t => ['PRODUCING','QA','FAILED','PUBLISHED','COMPLETED'].includes(t)); return found.join(',') || 'none'; })()" 2>/dev/null | tail -1)
  say "poll $i: estado=$ST"
  case "$ST" in
    *QA*|*FAILED*|*PUBLISHED*|*COMPLETED*)
      FINAL_STATUS="$ST"
      break
      ;;
  esac
  [ $((i % 8)) -eq 0 ] && agent-browser screenshot "$OUT/12-polling-progreso-$i.png"
done
sleep 3
agent-browser screenshot "$OUT/13-produccion-final.png"
say "polling terminado: estado final=$FINAL_STATUS (captura 13)"

# ── 6b. Launch package (puente por API documentado: sin botón UI) ──
LPKG=$(curl -s -X POST "$BASE/api/product/launch-package" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"productId":"'"$DOSSIER_ID"'","corePromise":"Composta sin olor en tu balcón en 30 días","cta":"Descarga la guía y empieza hoy"}')
LID=$(echo "$LPKG" | jq -r '.id // .data.id // empty' 2>/dev/null)
say "launch package creado (API, persistido): $LID"
[ -z "$LID" ] && say "respuesta launch-package: $(echo "$LPKG" | head -c 300)"

# ── 7. Ver el paquete en la sección Launch (UI1) ───────────────────
say "switch a Launch: $(click_button_text "Launch")"
sleep 3
agent-browser screenshot "$OUT/14-launch-con-paquete.png"
LSEEN=$(agent-browser eval "(() => { return document.body.innerText.includes('Composta sin olor') ? 'visible' : 'no-visible'; })()" 2>/dev/null | tail -1)
say "paquete visible en Launch (UI): $LSEEN"

# ── 8. Errores de consola e hidratación ────────────────────────────
agent-browser console > "$OUT/console.txt" 2>&1 || true
agent-browser errors > "$OUT/errores-pagina.txt" 2>&1 || true
say "consola y errores guardados"

agent-browser close || true
kill $SRV_PID 2>/dev/null || true
PIDS=$(ss -ltnp 2>/dev/null | grep ':3000 ' | grep -oP '(?<=pid=)[0-9]+' | sort -u)
[ -n "$PIDS" ] && echo "$PIDS" | xargs -r kill -9

echo "[ui4] COMPLETO — estado producción: ${FINAL_STATUS:-TIMEOUT}, fit=${FITTXT:-?}, launch=$LSEEN"
exit 0
