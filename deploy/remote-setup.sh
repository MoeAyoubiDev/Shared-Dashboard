#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/var/www/shared-dashboard

echo "== prepare app dir =="
sudo mkdir -p "$APP_DIR"
sudo chown -R "$(id -un):$(id -gn)" "$APP_DIR"
tar xzf /tmp/shared-dashboard.tgz -C "$APP_DIR"
cd "$APP_DIR"

echo "== .env =="
if [ ! -f .env ]; then
  JWT=$(openssl rand -base64 48 | tr -d '\n')
  ENCKEY=$(openssl rand -hex 32)
  cat > .env <<EOF
PORT=8080
DATABASE_URL=postgres://postgres:P%40ssw0rd@13.49.119.48:5432/shared_dashboard
JWT_SECRET=$JWT
CREDENTIAL_ENCRYPTION_KEY=$ENCKEY
SECURE_COOKIES=false
EOF
  chmod 600 .env
  echo "created .env (secrets generated on server)"
else
  echo ".env already exists, leaving untouched"
fi

echo "== install deps (npm ci, incl dev for build) =="
npm ci --include=dev

echo "== build =="
npm run build

echo "ALL DONE"
