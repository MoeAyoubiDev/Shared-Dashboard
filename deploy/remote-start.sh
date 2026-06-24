#!/usr/bin/env bash
set -euo pipefail
cd /var/www/shared-dashboard

echo "== (re)start under pm2 on port 8080 =="
pm2 delete shared-dashboard >/dev/null 2>&1 || true
PORT=8080 pm2 start npm --name shared-dashboard -- start
sleep 5

echo "== pm2 status =="
pm2 status

echo "== local smoke test =="
curl -s -o /dev/null -w "GET /login  -> HTTP %{http_code}\n" http://127.0.0.1:8080/login || echo "login curl failed"
curl -s -o /dev/null -w "GET /       -> HTTP %{http_code}\n" http://127.0.0.1:8080/ || echo "root curl failed"

echo "== persist pm2 across reboots =="
pm2 save
echo "START DONE"
