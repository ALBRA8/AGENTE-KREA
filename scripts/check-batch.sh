#!/bin/bash
BASE="http://localhost:3000"
echo "── Batch con 1 item, ver forma de respuesta ──"
curl -s -X POST $BASE/api/commercial/batch -H "Content-Type: application/json" \
  -d '{"items":[{"type":"email","params":{"productInfo":{"name":"Producto Test","description":"Descripción de prueba"},"creativeType":"header"}}],"concurrency":1}' \
  --max-time 240 | jq '{success, totalAssets: .data.totalAssets, completed: .data.progress.completed, failed: .data.progress.failed, item_status: [.data.progress.items[].status]}' 2>/dev/null
