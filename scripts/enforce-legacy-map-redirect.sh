#!/usr/bin/env bash
set -euo pipefail

NEW_DOMAIN="${NEW_DOMAIN:-maps.dothihoalac.vn}"
OLD_DOMAIN="${OLD_DOMAIN:-map.dothihoalac.vn}"
HTTP_REDIRECT_CONFIG="/etc/nginx/conf.d/hola-maps-legacy-http-redirect.conf"

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

# HTTPS and application traffic may live in one or more enabled files. Process
# every existing config containing the old hostname, but exclude the generated
# HTTP-only redirect file below.
mapfile -t ACTIVE_CONFIGS < <(
  grep -RIl --include='*' -E "server_name[^;]*${OLD_DOMAIN//./\\.}" \
    /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null \
    | grep -vF "$HTTP_REDIRECT_CONFIG" || true
)

if [ "${#ACTIVE_CONFIGS[@]}" -eq 0 ]; then
  warn "Could not find any enabled application config containing $OLD_DOMAIN."
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

  # Preserve the application vhost and redirect only requests whose Host is the
  # old HTTPS hostname. $request_uri keeps the full path and query string.
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

# The VPS also has a generic HTTP -> HTTPS redirect which keeps $host. Add an
# explicit port-80 vhost for the legacy hostname so HTTP requests jump directly
# to the canonical maps hostname in one 301 hop.
HTTP_REDIRECT_BACKUP=""
if [ -e "$HTTP_REDIRECT_CONFIG" ]; then
  HTTP_REDIRECT_BACKUP="${HTTP_REDIRECT_CONFIG}.before-map-301-${STAMP}"
  cp -a "$HTTP_REDIRECT_CONFIG" "$HTTP_REDIRECT_BACKUP"
fi

cat > "$HTTP_REDIRECT_CONFIG" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $OLD_DOMAIN;
    return 301 https://$NEW_DOMAIN\$request_uri;
}
EOF

if ! nginx -t; then
  warn "nginx -t failed; restoring all backups."
  for i in "${!REAL_CONFIGS[@]}"; do
    cp -a "${BACKUPS[$i]}" "${REAL_CONFIGS[$i]}"
  done
  if [ -n "$HTTP_REDIRECT_BACKUP" ]; then
    cp -a "$HTTP_REDIRECT_BACKUP" "$HTTP_REDIRECT_CONFIG"
  else
    rm -f "$HTTP_REDIRECT_CONFIG"
  fi
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
