#!/usr/bin/env bash
set -euo pipefail

NEW_DOMAIN="${NEW_DOMAIN:-maps.dothihoalac.vn}"
OLD_DOMAIN="${OLD_DOMAIN:-map.dothihoalac.vn}"
APP_DIR="${APP_DIR:-/var/www/bandohoalac}"

log() { printf '[maps-domain] %s\n' "$*"; }
warn() { printf '[maps-domain] WARN: %s\n' "$*" >&2; }

reload_nginx() {
  nginx -t
  systemctl reload nginx 2>/dev/null || nginx -s reload
}

upsert_env() {
  local file="$1" key="$2" value="$3"
  mkdir -p "$(dirname "$file")"
  touch "$file"
  if grep -qE "^[[:space:]]*${key}=" "$file"; then
    sed -E -i "s#^[[:space:]]*${key}=.*#${key}=${value}#" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

append_origin() {
  local file="$1" key="$2" origin="$3" current=""
  touch "$file"
  current="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n1 | cut -d= -f2- || true)"
  if printf '%s' ",$current," | grep -Fq ",$origin,"; then
    return
  fi
  if [ -n "$current" ]; then
    upsert_env "$file" "$key" "$current,$origin"
  else
    upsert_env "$file" "$key" "$origin"
  fi
}

if [ "$(id -u)" -ne 0 ]; then
  warn "Run as root (or with sudo)."
  exit 1
fi

command -v nginx >/dev/null 2>&1 || { warn "nginx is not installed."; exit 1; }
command -v certbot >/dev/null 2>&1 || { warn "certbot is not installed."; exit 1; }

if ! getent ahostsv4 "$NEW_DOMAIN" >/dev/null 2>&1; then
  warn "DNS for $NEW_DOMAIN is not resolving yet. No VPS changes were made."
  exit 2
fi

# A previous migration attempt created this copied vhost and failed nginx -t
# because it duplicated IPv6/443 listen options. Remove only that known stale
# generated vhost before touching the working legacy configuration.
STALE_AVAILABLE="/etc/nginx/sites-available/$NEW_DOMAIN"
STALE_ENABLED="/etc/nginx/sites-enabled/$NEW_DOMAIN"
if ! nginx -t >/dev/null 2>&1; then
  if [ -L "$STALE_ENABLED" ] || [ -e "$STALE_ENABLED" ] || [ -e "$STALE_AVAILABLE" ]; then
    STAMP="$(date +%Y%m%d%H%M%S)"
    if [ -e "$STALE_AVAILABLE" ]; then
      cp -a "$STALE_AVAILABLE" "${STALE_AVAILABLE}.failed-${STAMP}"
    fi
    rm -f "$STALE_ENABLED" "$STALE_AVAILABLE"
    log "Removed stale copied $NEW_DOMAIN vhost from the failed migration."
  fi
fi

nginx -t

OLD_ENABLED="$(grep -RIl --include='*' -E "server_name[^;]*${OLD_DOMAIN//./\\.}" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -n1 || true)"
if [ -z "$OLD_ENABLED" ]; then
  warn "Could not find the active Nginx config containing $OLD_DOMAIN."
  exit 1
fi

OLD_REAL="$(readlink -f "$OLD_ENABLED" 2>/dev/null || printf '%s' "$OLD_ENABLED")"
BACKUP="${OLD_REAL}.before-maps-safe-$(date +%Y%m%d%H%M%S)"
cp -a "$OLD_REAL" "$BACKUP"
log "Backed up active Nginx config to $BACKUP"

# Serve both hostnames from the SAME application vhost. This deliberately
# avoids copying listen directives, which caused the previous :443 conflict.
if ! grep -qE "server_name[^;]*${NEW_DOMAIN//./\\.}" "$OLD_REAL"; then
  sed -E -i "/server_name[^;]*${OLD_DOMAIN//./\\.}/ s/;/ ${NEW_DOMAIN};/" "$OLD_REAL"
fi

reload_nginx
log "Nginx now accepts both $OLD_DOMAIN and $NEW_DOMAIN on the existing vhost."

# Reuse/expand the currently configured certificate instead of creating a
# second vhost/certificate layout. The existing ssl_certificate path remains
# unchanged, but the renewed certificate gains the maps hostname as a SAN.
CERT_FULLCHAIN="$(awk '$1 == "ssl_certificate" { gsub(/;/, "", $2); print $2; exit }' "$OLD_REAL")"
if [ -z "$CERT_FULLCHAIN" ]; then
  warn "Could not detect the active ssl_certificate path in $OLD_REAL."
  exit 1
fi

CERT_DIR="$(dirname "$CERT_FULLCHAIN")"
CERT_NAME="$(basename "$CERT_DIR")"
log "Expanding certificate $CERT_NAME to cover both hostnames..."

certbot certonly \
  --nginx \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --cert-name "$CERT_NAME" \
  --expand \
  -d "$OLD_DOMAIN" \
  -d "$NEW_DOMAIN"

reload_nginx

log "Testing $NEW_DOMAIN locally through Nginx with the renewed certificate..."
curl --fail --silent --show-error --max-time 15 \
  --resolve "$NEW_DOMAIN:443:127.0.0.1" \
  "https://$NEW_DOMAIN/api/health" >/dev/null

BACKEND_ENV="$APP_DIR/backend/.env"
FRONTEND_ENV="$APP_DIR/frontend/.env"

upsert_env "$BACKEND_ENV" PUBLIC_BASE_URL "https://$NEW_DOMAIN"
upsert_env "$BACKEND_ENV" HOLA_MAPS_WEB_URL "https://$NEW_DOMAIN"
append_origin "$BACKEND_ENV" CORS_ORIGIN "https://$NEW_DOMAIN"
append_origin "$BACKEND_ENV" CORS_ORIGIN "https://$OLD_DOMAIN"
append_origin "$BACKEND_ENV" PUBLIC_API_CORS_ORIGIN "https://$NEW_DOMAIN"
append_origin "$BACKEND_ENV" PUBLIC_API_CORS_ORIGIN "https://$OLD_DOMAIN"
upsert_env "$FRONTEND_ENV" VITE_API_URL "https://$NEW_DOMAIN/api"

log "Production env switched to https://$NEW_DOMAIN"
log "$OLD_DOMAIN remains a compatibility alias for now; canonical app/API URLs use $NEW_DOMAIN."
