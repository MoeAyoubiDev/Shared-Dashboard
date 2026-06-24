#!/usr/bin/env bash
set -uo pipefail
export PGPASSWORD='P@ssw0rd'
export PGCONNECT_TIMEOUT=10
export PGSSLMODE=prefer
HOST=172.31.24.84

echo "== TCP port test =="
if timeout 8 bash -c "cat < /dev/null > /dev/tcp/$HOST/5432"; then
  echo "PORT OPEN"
else
  echo "PORT BLOCKED"
  exit 0
fi

echo "== server version (sslmode=prefer) =="
psql -h "$HOST" -U postgres -d postgres -tAc "select version();" 2>&1

echo "== is this session using SSL? =="
psql -h "$HOST" -U postgres -d postgres -tAc \
  "select ssl from pg_stat_ssl where pid = pg_backend_pid();" 2>&1

echo "== does database Shared-Dashboard exist? =="
psql -h "$HOST" -U postgres -d postgres -tAc \
  "select datname from pg_database where datname='Shared-Dashboard';" 2>&1
