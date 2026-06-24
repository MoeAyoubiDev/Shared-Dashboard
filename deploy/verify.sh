#!/usr/bin/env bash
set -uo pipefail
export PGPASSWORD='P@ssw0rd'
export PGSSLMODE=prefer
HOST=172.31.24.84

echo "== users in DB (username / email / type) =="
psql -h "$HOST" -U postgres -d 'Shared-Dashboard' -tAc \
  "select id, username, coalesce(email,'-'), user_type from users order by id;"

echo "== login with USERNAME (dxbitar) =="
curl -s -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"dxbitar","password":"IaeXMX2MZbGaUd"}' \
  -w "\nHTTP %{http_code}\n"

echo "== login with WRONG password (should be 401) =="
curl -s -o /dev/null -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"dxbitar","password":"nope"}' \
  -w "HTTP %{http_code}\n"
