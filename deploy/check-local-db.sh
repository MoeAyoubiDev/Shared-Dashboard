#!/usr/bin/env bash
set -uo pipefail

echo "== is postgres installed? =="
which psql pg_ctl pg_lsclusters 2>/dev/null || true
dpkg -l 2>/dev/null | grep -iE 'postgresql-[0-9]' | awk '{print $2, $3}' || echo "no postgresql-server package"

echo "== postgres service =="
systemctl is-active postgresql 2>/dev/null || echo "postgresql service not active"
sudo pg_lsclusters 2>/dev/null || true

echo "== anything listening on 5432 locally? =="
sudo ss -tlnp | awk 'NR==1 || /5432/'

echo "== docker postgres containers? =="
sudo docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' 2>/dev/null | grep -iE 'postgres|pg' || echo "no docker postgres (or docker not used)"

echo "== other apps' DB hints (.env files under /var/www) =="
sudo grep -rhoiE '(DATABASE_URL|DB_HOST|PG_HOST|POSTGRES_HOST|DB_CONNECTION)[^[:space:]]*' /var/www/*/.env 2>/dev/null | sed -E 's/(password|PASSWORD)=[^@ ]*/\1=***/g' | sort -u | head -20 || echo "none found"
