#!/bin/bash
# Diagnóstico rápido de los fallos detectados
BASE="http://localhost:3000"
echo "── Headers de seguridad en /api/health ──"
curl -sI $BASE/api/health --max-time 10 | head -15

echo ""
echo "── Auto-login (forma real de respuesta) ──"
R=$(curl -s -X POST $BASE/api/auth/auto-login --max-time 20)
echo "$R" | jq '{token: (.token | length), user: .user}' 

TOKEN=$(echo "$R" | jq -r '.token')
echo "TOKEN len: ${#TOKEN}"

echo ""
echo "── /api/auth/me con token correcto ──"
curl -s -o /dev/null -w "status: %{http_code}\n" $BASE/api/auth/me -H "Authorization: Bearer $TOKEN" --max-time 15

echo "── /api/metrics con token ──"
curl -s -o /dev/null -w "status: %{http_code}\n" "$BASE/api/metrics" -H "Authorization: Bearer $TOKEN" --max-time 15

echo "── /api/generations con token ──"
curl -s -o /dev/null -w "status: %{http_code}\n" "$BASE/api/generations" -H "Authorization: Bearer $TOKEN" --max-time 15

echo "── /api/adn/observability con token ──"
curl -s -o /dev/null -w "status: %{http_code}\n" $BASE/api/adn/observability -H "Authorization: Bearer $TOKEN" --max-time 15

echo "── /api/adn/security/audit con token ──"
curl -s -o /dev/null -w "status: %{http_code}\n" $BASE/api/adn/security/audit -H "Authorization: Bearer $TOKEN" --max-time 15

echo ""
echo "── /api/adn/doctor (cuerpo del 503) ──"
curl -s $BASE/api/adn/doctor --max-time 25 | jq '.' 2>/dev/null | head -40

echo ""
echo "── Login con contraseña antigua demo123 ──"
curl -s -o /dev/null -w "status: %{http_code}\n" -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"demo@krea.ai","password":"demo123"}' --max-time 20
