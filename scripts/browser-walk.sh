#!/bin/bash
# FASE 4 — Recorrido real en navegador (headless) con refs de snapshot:
# registro → imagen IA → oportunidad+fit → producción async → QA → Launch.
set -u
cd /home/z/my-project
OUT=download/evidencia-fase4
mkdir -p "$OUT"
BASE=http://localhost:3000
STAMP=$(date +%s)
EMAIL="walker${STAMP}@krea.local"
PASS="walker-test-123456"

# ref de un elemento accesible por su nombre visible (botón o textbox)
ref_for() {
  local label="$1"
  # match por prefijo: los botones del nav llevan sufijo de costos ("-3", "NUEVO"...)
  # con reintentos (el snapshot puede salir vacío si la página está re-renderizando)
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

# Click DOM real vía eval: los nav-buttons se re-renderizan y el click de
# Playwright a veces cae en un nodo desmontado
click_button_text() {
  agent-browser eval "(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim().startsWith('$1')); if (b) { b.click(); return 'clicked'; } return 'not-found'; })()" 2>/dev/null | tail -1
}

click_ref() {
  if [ -z "$1" ]; then
    echo "[walk] FATAL: ref vacío al hacer clic — snapshot:"
    agent-browser snapshot -i | head -25
    exit 4
  fi
  agent-browser click "@$1"
}
fill_ref() {
  if [ -z "$1" ]; then
    echo "[walk] FATAL: ref vacío al rellenar — snapshot:"
    agent-browser snapshot -i | head -25
    exit 4
  fi
  agent-browser fill "@$1" "$2"
}

wait_health() {
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health" --max-time 3 2>/dev/null || true)
    [ "$code" = "200" ] && { echo "[walk] servidor listo (intento $i)"; return 0; }
    sleep 2
  done
  return 2
}

# ── 0. Servidor ─────────────────────────────────────────────────────
nohup npm run start > /tmp/krea-server-f4.log 2>&1 &
SRV_PID=$!
disown || true
wait_health || { echo "FATAL: servidor no respondió"; exit 2; }

# ── 1. Landing/auth ────────────────────────────────────────────────
agent-browser open "$BASE" --timeout 30000
sleep 2
# sesión limpia en cada recorrido (el daemon del navegador persiste localStorage)
agent-browser storage local clear
agent-browser cookies clear
agent-browser reload
sleep 3
agent-browser screenshot "$OUT/01-login.png"
say() { echo "[walk] $*"; }
say "captura 01-login"

# ── 2. Registro vía UI ─────────────────────────────────────────────
TAB=$(ref_for "Crear cuenta")
click_ref "$TAB"
sleep 1
NOMBRE=$(ref_for "Tu nombre")
EMAILBOX=$(ref_for "tu@email.com")
PASSBOX=$(ref_for "Mínimo 6 caracteres")
fill_ref "$NOMBRE" "Walker F4"
fill_ref "$EMAILBOX" "$EMAIL"
fill_ref "$PASSBOX" "$PASS"
agent-browser screenshot "$OUT/02-registro-form.png"
SUBMIT=$(ref_for "Crear mi cuenta")
click_ref "$SUBMIT"
sleep 5
agent-browser screenshot "$OUT/03-app-tras-registro.png"
agent-browser get url || true
say "captura 03-app (registro por UI)"

# ── 3. Generador de imágenes ───────────────────────────────────────
IMGNAV=$(ref_for "Generador de Imágenes")
[ -z "$IMGNAV" ] && { say "nav de imágenes no visible; snapshot:"; agent-browser snapshot -i | head -30; exit 3; }
click_ref "$IMGNAV"
sleep 2
TA=$(ref_first_textbox)
fill_ref "$TA" "Un tazón de café de especialidad sobre fondo oscuro con vapor visible y granos alrededor, fotografía publicitaria profesional"
agent-browser screenshot "$OUT/04-imagen-form.png"
say "generando imagen real (3 créditos)…"
GENBTN=$(agent-browser snapshot -i 2>/dev/null | grep -E "Generar imagen" | grep -oE 'ref=(e[0-9]+)' | head -1 | grep -oE 'e[0-9]+')
click_ref "$GENBTN"
# la generación real tarda ~20-40s: espera fija y captura
sleep 40
agent-browser screenshot "$OUT/05-imagen-generada.png"
say "captura 05-imagen-generada (40s de espera)"

# ── 4. Product Factory: oportunidad + fit ─────────────────────────
say "switch a Product Factory: $(click_button_text "Product Factory")"
sleep 3
agent-browser screenshot "$OUT/06-factory-oportunidades.png"
NEWOPP=$(ref_for "Nueva Oportunidad")
click_ref "$NEWOPP"
sleep 1
T1=$(ref_for "Ej: Guía de Marketing Digital 2025")
T2=$(ref_for "Ej: Emprendedores digitales hispanohablantes")
T3=$(ref_first_textbox)
fill_ref "$T1" "Fermentación casera sin miedo"
fill_ref "$T2" "Cocineros aficionados que temen contaminar sus fermentos"
fill_ref "$T3" "Búsquedas de fermentar vegetales crecen; el miedo a la contaminación es la barrera número 1 en foros de cocina"
agent-browser screenshot "$OUT/07-oportunidad-form.png"
say "crear + evaluar oportunidad (fit con LLM real)…"
EVAL=$(ref_for "Evaluar Oportunidad")
click_ref "$EVAL"
sleep 18
agent-browser screenshot "$OUT/08-oportunidad-evaluada.png"

TOKEN=$(agent-browser storage local p360_token 2>/dev/null | tail -1 | awk '{print $NF}')
say "token: ${TOKEN:0:12}…"

# HALLAZGO DE UI (documentado, sin rediseñar): el dashboard crea la oportunidad
# pero NO tiene botón para crear dossier ni para evaluar fit — se hace por API
# con el token de la sesión del navegador (igual que hace el smoke p6).
OPPID=$(curl -s "$BASE/api/product/opportunities" -H "Authorization: Bearer $TOKEN" | jq -r 'if type=="array" then (.[0].id // empty) else ((.opportunities // . // [])[0].id // empty) end' 2>/dev/null)
say "oportunidad: $OPPID"
DOSSIER=$(curl -s -X POST "$BASE/api/product/dossiers" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"productName":"Fermentación casera sin miedo","productType":"ebook"}')
DID=$(echo "$DOSSIER" | jq -r '.id // empty')
say "dossier: $DID"
[ -z "$DID" ] && { echo "FATAL: sin dossier: $DOSSIER"; agent-browser console > "$OUT/console.txt" 2>&1; exit 3; }

# ── 5. Producción async (202) desde la UI ──────────────────────────
# Click DOM real vía eval: los nav-buttons se re-renderizan y el click de
# Playwright a veces cae en un nodo desmontado
click_button_text() {
  agent-browser eval "(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim().startsWith('$1')); if (b) { b.click(); return 'clicked'; } return 'not-found'; })()" 2>/dev/null | tail -1
}
say "switch a sección Producción: $(click_button_text "Producción")"
sleep 2
say "abrir form producción: $(click_button_text "Nueva Producción")"
sleep 1
sleep 1
DIN=$(ref_for "Pega el ID del dossier aprobado...")
fill_ref "$DIN" "$DID"
agent-browser screenshot "$OUT/09-produccion-form.png"
say "iniciar pipeline (202 async, 12 créditos)…"
START=$(ref_for "Iniciar Pipeline")
click_ref "$START"
sleep 4
agent-browser screenshot "$OUT/10-produccion-202.png"
say "captura 10: job en PRODUCING (UI no bloquea)"

# ── 6b. Login por UI como usuario con producto COMPLETADO (smoke p6 real:
# dossier QA + ejecución COMPLETED en BD — la corrida completa de producción
# tarda ~515s y su evidencia está en download/evidencia-smoke-commercial/) ──
say "cerrar sesión por UI…"
LOGOUT=$(ref_for "Cerrar sesión")
[ -n "$LOGOUT" ] && click_ref "$LOGOUT"
sleep 3
P6EMAIL="smokep61795395533@krea.local"
say "login por UI como $P6EMAIL…"
LOGTAB=$(ref_for "Iniciar sesión")
[ -n "$LOGTAB" ] && click_ref "$LOGTAB"
sleep 1
LE=$(ref_for "tu@email.com")
LP=$(ref_for "Mínimo 6 caracteres")
fill_ref "$LE" "$P6EMAIL"
fill_ref "$LP" "smoke-test-123456"
agent-browser screenshot "$OUT/11-login-completo.png"
# "Iniciar sesión" aparece 2 veces (pestaña + submit): tomar el ÚLTIMO ref
LSUBMIT=$(agent-browser snapshot -i 2>/dev/null | grep -F '"Iniciar sesión"' | grep -oE 'ref=(e[0-9]+)' | tail -1 | grep -oE 'e[0-9]+')
click_ref "$LSUBMIT"
sleep 5
TOKEN=$(agent-browser storage local p360_token 2>/dev/null | tail -1 | awk '{print $NF}')
say "token de la sesión p6: ${TOKEN:0:12}…"

# estado de producción del dossier COMPLETADO, visto en la UI
say "switch a Product Factory: $(click_button_text "Product Factory")"
sleep 3
say "switch a sección Producción: $(click_button_text "Producción")"
sleep 3
agent-browser screenshot "$OUT/12-produccion-QA.png"

# launch package por API (el pipeline 10-pasos ya generó los datos en la
# ejecución COMPLETED; esta ruta los materializa como paquete consultable)
P6DOSSIER="cmwsk58mu0006ng2458ykkqw7"
LPKG=$(curl -s -X POST "$BASE/api/product/launch-package" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"productId":"'"$P6DOSSIER"'","corePromise":"Domina la fermentación casera sin riesgo de contaminación en 7 días","cta":"Descarga la guía y empieza hoy"}')
LID=$(echo "$LPKG" | jq -r '.id // .data.id // .packageId // empty')
say "launch package creado: $LID"
[ -z "$LID" ] && say "respuesta launch-package: $(echo "$LPKG" | head -c 200)"

say "switch a Launch: $(click_button_text "Launch")"
sleep 1
sleep 3
agent-browser screenshot "$OUT/13-launch-package.png"

# ── 7. Errores de consola ────────────────────────────────────────────
agent-browser console > "$OUT/console.txt" 2>&1 || true
agent-browser errors > "$OUT/errores-pagina.txt" 2>&1 || true
say "consola y errores guardados"

agent-browser close || true
kill $SRV_PID 2>/dev/null || true
PIDS=$(ss -ltnp 2>/dev/null | grep ':3000 ' | grep -oP '(?<=pid=)[0-9]+' | sort -u)
[ -n "$PIDS" ] && echo "$PIDS" | xargs -r kill -9

echo "[walk] COMPLETO"
exit 0
