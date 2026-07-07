#!/usr/bin/env bash
# Starts (or repoints) the public Cloudflare quick-tunnel to the app.
# Usage:  PORT=8003 bash deploy/start-tunnel.sh
set -e

PORT="${PORT:-8003}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "installing cloudflared..."
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
  sudo install -m 0755 /tmp/cloudflared /usr/local/bin/cloudflared
fi
echo "cloudflared: $(cloudflared --version 2>&1 | head -1)"
echo "pointing tunnel at http://localhost:$PORT"

pm2 delete dash-tunnel >/dev/null 2>&1 || true
pm2 start cloudflared --name dash-tunnel -- tunnel --no-autoupdate --url "http://localhost:$PORT"
pm2 save >/dev/null 2>&1 || true

echo "waiting for tunnel to come up..."
sleep 15

URL=$(pm2 logs dash-tunnel --lines 300 --nostream 2>/dev/null \
  | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)

echo "===================================================="
if [ -n "$URL" ]; then
  echo "PUBLIC_URL=$URL"
else
  echo "URL not found yet; recent logs:"
  pm2 logs dash-tunnel --lines 25 --nostream 2>/dev/null | tail -25
fi
echo "===================================================="
