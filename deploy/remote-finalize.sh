#!/usr/bin/env bash
set -euo pipefail
cd /var/www/shared-dashboard

export PGPASSWORD='P@ssw0rd'
export PGCONNECT_TIMEOUT=10
export PGSSLMODE=prefer
DBHOST=172.31.24.84
DBNAME='Shared-Dashboard'

echo "== ensure database '$DBNAME' exists =="
EXISTS=$(psql -h "$DBHOST" -U postgres -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='$DBNAME'" || true)
if [ "$EXISTS" = "1" ]; then
  echo "database already exists"
else
  psql -h "$DBHOST" -U postgres -d postgres -c "CREATE DATABASE \"$DBNAME\""
  echo "database created"
fi

echo "== run migrations (creates tables, idempotent) =="
npm run migrate

echo "== seed first trainer (idempotent upsert) =="
node scripts/create-trainer.mjs "$TRAINER_EMAIL" "$TRAINER_NAME" "$TRAINER_PASSWORD"

echo "== restart app =="
pm2 restart shared-dashboard >/dev/null
sleep 5

echo "== end-to-end: wrong password should be 401 =="
curl -s -o /dev/null -w "  bad creds  -> HTTP %{http_code}\n" \
  -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"'"$TRAINER_EMAIL"'","password":"definitely-wrong"}'

echo "== end-to-end: correct password should be 200 =="
curl -s -o /dev/null -w "  good creds -> HTTP %{http_code}\n" \
  -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"'"$TRAINER_EMAIL"'","password":"'"$TRAINER_PASSWORD"'"}'

echo "== tables now in the database =="
psql -h "$DBHOST" -U postgres -d "$DBNAME" -tAc \
  "select table_name from information_schema.tables where table_schema='public' order by 1;"

echo "FINALIZE DONE"
