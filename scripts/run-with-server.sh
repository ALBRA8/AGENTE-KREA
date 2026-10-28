#!/bin/bash
# Runner: arranca el servidor de producción, ejecuta un script de pruebas y apaga el servidor
# Uso: run-with-server.sh <test-script.sh>
set -u
TEST_SCRIPT="$1"
cd /home/z/my-project

# Asegurar puerto libre
fuser -k 3000/tcp 2>/dev/null; sleep 1

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
fuser -k 3000/tcp 2>/dev/null
echo "[runner] Servidor detenido. Exit pruebas: $TEST_EXIT"
exit $TEST_EXIT
