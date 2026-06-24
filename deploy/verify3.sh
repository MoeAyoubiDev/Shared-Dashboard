#!/usr/bin/env bash
set -uo pipefail
B=http://127.0.0.1:8080

count() { grep -o '"canEdit":' | wc -l; }

echo "== TRAINER dxbitar =="
curl -s -c /tmp/cjT -o /dev/null -X POST $B/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"dxbitar","password":"IaeXMX2MZbGaUd"}'
echo "  all projects : $(curl -s -b /tmp/cjT "$B/api/projects" | count)"
echo "  my projects  : $(curl -s -b /tmp/cjT "$B/api/projects?scope=mine" | count)"

echo "== TRAINEE reem =="
code=$(curl -s -c /tmp/cjR -o /dev/null -w '%{http_code}' -X POST $B/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"reem","password":"CnB2aYQdHWKz"}')
echo "  login HTTP   : $code"
echo "  all projects : $(curl -s -b /tmp/cjR "$B/api/projects" | count)   (should equal trainer's all)"
echo "  my projects  : $(curl -s -b /tmp/cjR "$B/api/projects?scope=mine" | count)"
echo "  canEdit in ALL view:"
curl -s -b /tmp/cjR "$B/api/projects" | grep -oE '"canEdit":(true|false)' | sort | uniq -c | sed 's/^/    /'

echo "== new UI live? (login page) =="
html=$(curl -s $B/login)
echo "$html" | grep -q 'login-logo">SD<' && echo "  monogram SD present: yes" || echo "  monogram SD present: NO"
echo "$html" | grep -q '📊' && echo "  emoji present: YES (bad)" || echo "  emoji present: no"

rm -f /tmp/cjT /tmp/cjR
