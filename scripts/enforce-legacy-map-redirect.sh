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

# HTTP and HTTPS can live in different Nginx files. Process every enabled
# config containing the legacy hostname instead of stopping at the first one.
mapfile -t ACTIVE_CONFIGS < <(
  grep -RIl --include='*' -E "server_name[^;]*${OLD_DOMAIN//./\\.}" \
    /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null || true
)

if [ "${#ACTIVE_CONFIGS[@]}" -eq 0 ]; then
  warn "Could not find any enabled Nginx config containing $OLD_DOMAIN."
  exit 1
fi

declare -A SEEN_REAL=()
REAL_CONFIGS=()
BACKUPS=()

for active in "${ACTIVE_CONFIGS[@]}"; do
  real="$(readlink -f "$active" 2>/dev/null || printf '%s' "$active")"
  if [ -n "${SEEN_REAL[$real]:-}" ]; then
    continue
  fi
  SEEN_REAL[$real]=1
  REAL_CONFIGS+=("$real")
done

STAMP="$(date +%Y%m%d%H%M%S)"

for config in "${REAL_CONFIGS[@]}"; do
  backup="${config}.before-map-301-${STAMP}"
  cp -a "$config" "$backup"
  BACKUPS+=("$backup")
  log "Backed up Nginx config to $backup"

  # Keep the application vhost intact. Add a host-specific server-level return
  # rule after every server_name that accepts the old hostname. $request_uri
  # preserves the complete path and query string. Strip generated rules first
  # so reruns are idempotent.
  tmp_file="$(mktemp)"
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
  ' "$config" > "$tmp_file"
  mv "$tmp_file" "$config"
done

if ! nginx -t; then
  warn "nginx -t failed; restoring all backups."
  for i in "${!REAL_CONFIGS[@]}"; do
    cp -a "${BACKUPS[$i]}" "${REAL_CONFIGS[$i]}"
  done
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
printf '%s\n' "$HEADERS"
printf '%s\n' "$HEADERS" | grep -Eq '^HTTP/[^ ]+ 301([[:space:]]|$)'
printf '%s\n' "$HEADERS" | grep -Eiq '^location: https://maps\.dothihoalac\.vn/map\?sort=nearest$'

log "Verifying old HTTP host redirects directly and preserves path/query..."
HTTP_HEADERS="$(curl --silent --show-error --head --max-time 15 \
  --resolve "$OLD_DOMAIN:80:127.0.0.1" \
  "http://$OLD_DOMAIN/developers?from=legacy" | tr -d '\r')"
printf '%s\n' "$HTTP_HEADERS"
printf '%s\n' "$HTTP_HEADERS" | grep -Eq '^HTTP/[^ ]+ 301([[:space:]]|$)'
printf '%s\n' "$HTTP_HEADERS" | grep -Eiq '^location: https://maps\.dothihoalac\.vn/developers\?from=legacy$'

log "301 redirect enabled: $OLD_DOMAIN/* -> $NEW_DOMAIN/*"
