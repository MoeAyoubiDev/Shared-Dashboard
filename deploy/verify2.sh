#!/usr/bin/env bash
set -uo pipefail
export PGPASSWORD='P@ssw0rd'
export PGSSLMODE=prefer
HOST=172.31.24.84
B=http://127.0.0.1:8080

echo "== created_by column present? =="
psql -h "$HOST" -U postgres -d 'Shared-Dashboard' -tAc \
  "select column_name from information_schema.columns where table_name='projects' and column_name='created_by';"

curl -s -c /tmp/cj -o /dev/null -X POST $B/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"dxbitar","password":"IaeXMX2MZbGaUd"}'

echo "== GET /api/projects (all) =="
curl -s -b /tmp/cj $B/api/projects -w "\nHTTP %{http_code}\n" | tail -c 200

echo "== GET /api/projects?scope=mine =="
curl -s -b /tmp/cj "$B/api/projects?scope=mine" -w "\nHTTP %{http_code}\n" | tail -c 200

echo "== change-password with WRONG current (expect 401) =="
curl -s -b /tmp/cj -o /dev/null -X POST $B/api/auth/change-password \
  -H 'Content-Type: application/json' \
  -d '{"currentPassword":"wrong","newPassword":"abcd1234"}' \
  -w "HTTP %{http_code}\n"

echo "== @mention search still works (q=sara) =="
curl -s -b /tmp/cj "$B/api/users/search?q=sara" ; echo

rm -f /tmp/cj
