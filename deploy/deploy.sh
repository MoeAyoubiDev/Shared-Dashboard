#!/usr/bin/env bash
#
# Shared Dashboard — one-command deploy for an Ubuntu server.
# Builds the app and runs it under pm2 on PORT (default 8003).
#
# Usage (from the project root):
#     bash deploy/deploy.sh
# Override the port:
#     PORT=8003 bash deploy/deploy.sh
#
set -euo pipefail

APP_NAME="shared-dashboard"
PORT="${PORT:-8003}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=================================================="
echo "  Shared Dashboard — deploy"
echo "  Path : $ROOT"
echo "  Port : $PORT"
echo "=================================================="

# 1) Prerequisites ------------------------------------------------------
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js 18+ is required."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERROR: npm is required."; exit 1; }
if ! command -v pm2 >/dev/null 2>&1; then
  echo ">> Installing pm2 globally..."
  sudo npm install -g pm2
fi

# 2) .env — created on first run, then stop so you can set DATABASE_URL --
if [ ! -f .env ]; then
  echo ">> No .env found. Creating one with freshly generated secrets..."
  JWT=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
  ENC=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  cat > .env <<EOF
# Port the server listens on
PORT=$PORT

# PostgreSQL connection string  (EDIT THIS)
# Use sslmode=no-verify if the DB uses a self-signed certificate.
DATABASE_URL=postgres://USER:PASSWORD@DB_HOST:5432/DB_NAME?sslmode=prefer

# Auto-generated secrets — keep these safe, do not share or change them.
JWT_SECRET=$JWT
CREDENTIAL_ENCRYPTION_KEY=$ENC

# Set to true only when served over HTTPS
SECURE_COOKIES=false
EOF
  chmod 600 .env
  echo ""
  echo "  .env created at $ROOT/.env"
  echo "  >> EDIT IT NOW and set DATABASE_URL, then run this script again:"
  echo "       bash deploy/deploy.sh"
  exit 0
fi

# Keep the PORT line in .env in sync with the chosen port.
if grep -q '^PORT=' .env; then
  sed -i "s/^PORT=.*/PORT=$PORT/" .env
else
  printf '\nPORT=%s\n' "$PORT" >> .env
fi

# 3) Dependencies -------------------------------------------------------
echo ">> Installing dependencies (npm ci)..."
npm ci --include=dev

# 4) Build --------------------------------------------------------------
echo ">> Building production bundle..."
npm run build

# 5) Database migrations ------------------------------------------------
echo ">> Applying database schema/migrations..."
npm run migrate

# 6) Start / reload under pm2 on $PORT ----------------------------------
echo ">> Starting under pm2 on port $PORT..."
export PORT
pm2 startOrReload ecosystem.config.cjs --update-env 2>/dev/null \
  || pm2 start ecosystem.config.cjs --update-env
pm2 save

echo ""
echo "=================================================="
echo "  Done. '$APP_NAME' is running on port $PORT."
echo "  Local check:  curl -I http://127.0.0.1:$PORT/login"
echo ""
echo "  Create the first admin (trainer) account:"
echo "    node scripts/create-trainer.mjs <username> \"<Full Name>\" <password>"
echo "=================================================="
