#!/bin/bash
BASE="http://localhost:3000"
echo "── LOGO (error real) ──"
curl -s -X POST $BASE/api/commercial/logo -H "Content-Type: application/json" \
  -d '{"brandName":"KREA Test","style":"minimalist","variants":1,"language":"es"}' \
  --max-time 120 | jq -c '{success, error, data_keys: (.data|keys?)}' 2>/dev/null | head -c 600
echo ""
echo "── EMAIL (error real) ──"
curl -s -X POST $BASE/api/commercial/email -H "Content-Type: application/json" \
  -d '{"productInfo":"Curso de marketing digital 149€","creativeType":"promotional","language":"es"}' \
  --max-time 120 | head -c 600
echo ""
echo "── CATALOG (error real) ──"
curl -s -X POST $BASE/api/commercial/catalog -H "Content-Type: application/json" \
  -d '{"products":[{"name":"Camiseta","price":"29.99"}],"catalogFormat":"bifold","language":"es"}' \
  --max-time 120 | head -c 600
