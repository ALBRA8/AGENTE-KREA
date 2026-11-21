#!/bin/bash
BASE="http://localhost:3000"
curl -s $BASE/api/adn/doctor --max-time 30 | jq '{overallStatus, healthScore, unhealthyChecks: [.checks[] | select(.status=="UNHEALTHY") | {name, status, details}], degradedChecks: [.checks[] | select(.status=="DEGRADED") | {name, details}], totalChecks: (.checks | length)}'
