#!/bin/bash
# Runner: arranca el servidor de producción, ejecuta un script de pruebas y apaga el servidor
# Uso: run-with-server.sh <test-script.sh>
set -u
TEST_SCRIPT="$1"
cd /home/z/my-project

# Asegurar puerto libre — fuser no existe en todos los entornos y lsof puede
# no ver procesos del sandbox; ss -ltnp es la vía más fiable aquí
kill_port_3000() {
  local pids=""
  if command -v ss >/dev/null 2>&1; then
    pids=$(ss -ltnp 2>/dev/null | grep ':3000 ' | grep -oP '(?<=pid=)[0-9]+' | sort -u || true)
  fi
  if [ -z "$pids" ] && command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -t -i :3000 2>/dev/null || true)
  fi
  if [ -n "$pids" ]; then
    echo "$pids" | xargs -r kill -9 2>/dev/null || true
    sleep 1
  fi
}
kill_port_3000

# Verificación dura: el puerto DEBE estar libre, si no, abortar (evita golpear un servidor viejo)
if ss -ltn 2>/dev/null | grep -q ":3000 "; then
  echo "[runner] ERROR: el puerto 3000 sigue ocupado; abortando para no probar contra un servidor obsoleto"
  exit 3
fi

# Arrancar servidor
npm run start > /tmp/krea-server.log 2>&1 &
SERVER_PID=$!

# Esperar a que responda
READY=0
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health --max-time 3 2>/dev/null)
  if [ "$code" = "200" ]; then READY=1; echo "[runner] Servidor listo (intento $i)"; break; fi
  sleep 1
done

if [ "$READY" != "1" ]; then
  echo "[runner] ERROR: servidor no respondió a tiempo"; kill $SERVER_PID 2>/dev/null; exit 2
fi

# Ejecutar pruebas
bash "$TEST_SCRIPT"
TEST_EXIT=$?

# Apagar servidor
kill $SERVER_PID 2>/dev/null
kill_port_3000
echo "[runner] Servidor detenido. Exit pruebas: $TEST_EXIT"
exit $TEST_EXIT
