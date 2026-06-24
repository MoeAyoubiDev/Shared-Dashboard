#!/usr/bin/env bash
set -euo pipefail
cd /var/www/shared-dashboard

echo "== extract new source (preserves .env and node_modules) =="
tar xzf /tmp/shared-dashboard.tgz -C /var/www/shared-dashboard
echo "extracted"

echo "== build =="
npm run build 2>&1 | tail -16

echo "== migrate live DB (adds username, makes email optional) =="
npm run migrate

echo "== restart app =="
pm2 restart shared-dashboard >/dev/null
sleep 5
pm2 status | awk 'NR==1 || /shared-dashboard/'

echo "REDEPLOY DONE"
