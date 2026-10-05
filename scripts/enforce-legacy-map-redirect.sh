#!/usr/bin/env bash
set -euo pipefail

NEW_DOMAIN="${NEW_DOMAIN:-maps.dothihoalac.vn}"
OLD_DOMAIN="${OLD_DOMAIN:-map.dothihoalac.vn}"

log() { printf '[map-301] %s\n' "$*"; }
warn() { printf '[map-301] WARN: %s\n' "$*" >&2; }

if [ "$(id -u)" -ne 0 ]; then
  warn "Run as root (or with sudo)."
  exit 1
fi

command -v nginx >/dev/null 2>&1 || { warn "nginx is not installed."; exit 1; }
command -v curl >/dev/null 2>&1 || { warn "curl is not installed."; exit 1; }

if ! getent ahostsv4 "$NEW_DOMAIN" >/dev/null 2>&1; then
  warn "DNS for $NEW_DOMAIN is not resolving. Redirect was not changed."
  exit 2
fi

ACTIVE_CONFIG="$(grep -RIl --include='*' -E "server_name[^;]*${OLD_DOMAIN//./\\.}" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -n1 || true)"
if [ -z "$ACTIVE_CONFIG" ]; then
  warn "Could not find an enabled Nginx config containing $OLD_DOMAIN."
  exit 1
fi

REAL_CONFIG="$(readlink -f "$ACTIVE_CONFIG" 2>/dev/null || printf '%s' "$ACTIVE_CONFIG")"
BACKUP="${REAL_CONFIG}.before-map-301-$(date +%Y%m%d%H%M%S)"
cp -a "$REAL_CONFIG" "$BACKUP"
log "Backed up Nginx config to $BACKUP"

# Keep the canonical vhost intact and add a host-specific return rule to every
# server block that still accepts the old hostname. $request_uri preserves the
# complete path plus query string. Existing generated rules are stripped first
# so this operation is idempotent.
TMP_FILE="$(mktemp)"
awk -v old="$OLD_DOMAIN" -v new="$NEW_DOMAIN" '
  /# HOLA_MAPS_LEGACY_301/ { next }
  /if \(\$host = map\.dothihoalac\.vn\).*return 301 https:\/\/maps\.dothihoalac\.vn\$request_uri/ { next }
  {
    print $0
    if ($0 ~ /^[[:space:]]*server_name[[:space:]]/ && index($0, old) > 0) {
      print "    # HOLA_MAPS_LEGACY_301"
      print "    if ($host = " old ") { return 301 https://" new "$request_uri; }"
    }
  }
' "$REAL_CONFIG" > "$TMP_FILE"
mv "$TMP_FILE" "$REAL_CONFIG"

if ! nginx -t; then
  cp -a "$BACKUP" "$REAL_CONFIG"
  warn "nginx -t failed; restored $BACKUP"
  nginx -t
  exit 1
fi

systemctl reload nginx 2>/dev/null || nginx -s reload

log "Verifying canonical host still serves the application..."
curl --fail --silent --show-error --max-time 15 \
  --resolve "$NEW_DOMAIN:443:127.0.0.1" \
  "https://$NEW_DOMAIN/api/health" >/dev/null

log "Verifying old HTTPS host redirects and preserves path/query..."
HEADERS="$(curl --silent --show-error --head --max-time 15 \
  --resolve "$OLD_DOMAIN:443:127.0.0.1" \
  "https://$OLD_DOMAIN/map?sort=nearest" | tr -d '\r')"
printf '%s\n' "$HEADERS" | grep -Eq '^HTTP/[^ ]+ 301([[:space:]]|$)'
printf '%s\n' "$HEADERS" | grep -Eiq '^location: https://maps\.dothihoalac\.vn/map\?sort=nearest$'

log "Verifying old HTTP host redirects too..."
HTTP_HEADERS="$(curl --silent --show-error --head --max-time 15 \
  --resolve "$OLD_DOMAIN:80:127.0.0.1" \
  "http://$OLD_DOMAIN/developers?from=legacy" | tr -d '\r')"
printf '%s\n' "$HTTP_HEADERS" | grep -Eq '^HTTP/[^ ]+ 301([[:space:]]|$)'
printf '%s\n' "$HTTP_HEADERS" | grep -Eiq '^location: https://maps\.dothihoalac\.vn/developers\?from=legacy$'

log "301 redirect enabled: $OLD_DOMAIN/* -> $NEW_DOMAIN/*"
