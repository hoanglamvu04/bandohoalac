#!/usr/bin/env bash
set -euo pipefail

# Dynamic Nginx auth_request gateway for multi-tenant iframe embedding.
# Non-embed routes retain the existing X-Frame-Options: DENY hardening.
DOMAIN="${DOMAIN:-maps.dothihoalac.vn}"
APP_DIR="${APP_DIR:-/var/www/bandohoalac}"
API_UPSTREAM="${EMBED_API_UPSTREAM:-http://127.0.0.1:5003}"
SNIPPET="/etc/nginx/snippets/hola-maps-embed-gateway.conf"

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    exec sudo -n env DOMAIN="$DOMAIN" APP_DIR="$APP_DIR" EMBED_API_UPSTREAM="$API_UPSTREAM" bash "$0"
  fi
  echo "[embed] Root or passwordless sudo required to update Nginx." >&2
  exit 1
fi

case "$API_UPSTREAM" in
  http://127.0.0.1:*) ;;
  *) echo "[embed] Invalid local API upstream; use http://127.0.0.1:<port>." >&2; exit 1 ;;
esac

command -v nginx >/dev/null 2>&1 || { echo "[embed] Nginx is missing." >&2; exit 1; }
test -f "$APP_DIR/frontend/dist/index.html" || {
  echo "[embed] Frontend dist/index.html is missing. Build before configuring gateway." >&2
  exit 1
}

TARGET="$(grep -RIl --include='*' -E "server_name[^;]*${DOMAIN//./\\.}" \
  /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -n1 || true)"
test -n "$TARGET" || { echo "[embed] Active Nginx vhost for $DOMAIN is missing." >&2; exit 1; }
TARGET="$(readlink -f "$TARGET" 2>/dev/null || printf '%s' "$TARGET")"

mkdir -p /etc/nginx/snippets
STAMP="$(date +%Y%m%d%H%M%S)"
VHOST_BACKUP="${TARGET}.before-embed-${STAMP}"
SNIPPET_BACKUP="${SNIPPET}.before-embed-${STAMP}"
cp -a "$TARGET" "$VHOST_BACKUP"
if [ -f "$SNIPPET" ]; then cp -a "$SNIPPET" "$SNIPPET_BACKUP"; fi

# Pass only a public embed key to the backend. The API responds with an
# origin list assembled from APPROVED, unexpired database records.
cat > "$SNIPPET" <<EOF
# HOLA_EMBED_GATEWAY_V1
location = /__hola_embed_authorize {
  internal;
  proxy_pass ${API_UPSTREAM}/api/embed/authorize;
  proxy_pass_request_body off;
  proxy_set_header Content-Length "";
  proxy_set_header X-Original-URI \$request_uri;
  proxy_set_header Host \$host;
}

EOF

write_embed_location() {
  local location_match="$1"
  cat >> "$SNIPPET" <<EOF
location $location_match {
  auth_request /__hola_embed_authorize;
  auth_request_set \$hola_embed_allowed_origins \$upstream_http_x_hola_embed_allowed_origins;

  # Explicit root: production vhosts can declare root inside location /.
  root "$APP_DIR/frontend/dist";
  try_files /index.html =404;

  # A location-level add_header replaces inherited server X-Frame-Options DENY.
  # Never set an X-Frame-Options header in these two locations.
  add_header Content-Security-Policy "frame-ancestors 'self' \$hola_embed_allowed_origins; object-src 'none'; base-uri 'self'" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "no-referrer" always;
  add_header Permissions-Policy "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" always;
  add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
  add_header Cache-Control "private, no-store" always;
}

EOF
}

write_embed_location "= /embed"
write_embed_location "^~ /embed/"

# Public SEO documents must reach Express before the SPA index.html fallback.
# Express returns complete HTML with route-specific metadata and visible content.
write_seo_proxy_location() {
  local location_match="$1"
  cat >> "$SNIPPET" <<EOF
location $location_match {
  proxy_pass ${API_UPSTREAM};
  proxy_http_version 1.1;
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
  proxy_connect_timeout 5s;
  proxy_read_timeout 15s;
}

EOF
}

write_seo_proxy_location "= /kham-pha"
write_seo_proxy_location "^~ /kham-pha/"
write_seo_proxy_location "^~ /dia-diem/"
write_seo_proxy_location "^~ /place/"

# Idempotent: the include is installed only once per domain-bearing server block.
if ! grep -Fq "include $SNIPPET;" "$TARGET"; then
  python3 - "$TARGET" "$DOMAIN" "$SNIPPET" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
domain = sys.argv[2]
snippet = sys.argv[3]
original = path.read_text()
out = []
insertions = 0
for line in original.splitlines():
    out.append(line)
    if line.strip().startswith("server_name ") and domain in line:
        indent = line[:len(line) - len(line.lstrip())]
        out.append(f"{indent}# HOLA_EMBED_GATEWAY_V1")
        out.append(f"{indent}include {snippet};")
        insertions += 1
if not insertions:
    raise SystemExit("[embed] No matching server_name directive found")
path.write_text("\n".join(out) + "\n")
PY
fi

if ! nginx -t; then
  cp -a "$VHOST_BACKUP" "$TARGET"
  if [ -f "$SNIPPET_BACKUP" ]; then
    cp -a "$SNIPPET_BACKUP" "$SNIPPET"
  else
    rm -f "$SNIPPET"
  fi
  nginx -t
  echo "[embed] Invalid config rolled back; iframe policy unchanged." >&2
  exit 1
fi

systemctl reload nginx 2>/dev/null || nginx -s reload
echo "[embed] Dynamic iframe authorization enabled for $DOMAIN."
