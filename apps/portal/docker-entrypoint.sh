#!/bin/sh
set -e

API_URL="${PORTAL_API_URL:-}"

if [ -z "$API_URL" ]; then
  echo "[portal] AVISO: PORTAL_API_URL nao definido — o painel nao conseguira chamar a API"
else
  echo "[portal] API: $API_URL"
fi

# Escape para string JS
ESCAPED=$(printf '%s' "$API_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf 'window.__PORTAL_API_URL__="%s";\n' "$ESCAPED" > /usr/share/nginx/html/config.js

exec nginx -g 'daemon off;'
