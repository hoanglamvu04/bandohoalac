#!/usr/bin/env bash
set -euo pipefail

NEW_DOMAIN="${NEW_DOMAIN:-maps.dothihoalac.vn}"
OLD_DOMAIN="${OLD_DOMAIN:-map.dothihoalac.vn}"
APP_DIR="${APP_DIR:-/var/www/bandohoalac}"

log() { printf '[maps-domain] %s\n' "$*"; }
warn() { printf '[maps-domain] WARN: %s\n' "$*" >&2; }

if [ "$(id -u)" -ne 0 ]; then
  warn "Run as root (or with sudo) because Nginx/Certbot files must be changed."
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  warn "nginx is not installed."
  exit 1
fi

if ! getent ahostsv4 "$NEW_DOMAIN" >/dev/null 2>&1; then
  warn "DNS for $NEW_DOMAIN is not resolving yet. Add the DNS record first; no VPS changes were made."
  exit 2
fi

OLD_ENABLED="$(grep -RIl --include='*' -E "server_name[^;]*${OLD_DOMAIN//./\\.}" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -n1 || true)"
if [ -z "$OLD_ENABLED" ]; then
  warn "Could not find an enabled Nginx config containing $OLD_DOMAIN."
  exit 1
fi

OLD_REAL="$(readlink -f "$OLD_ENABLED" 2>/dev/null || printf '%s' "$OLD_ENABLED")"
BACKUP="${OLD_REAL}.before-maps-$(date +%Y%m%d%H%M%S)"
cp -a "$OLD_REAL" "$BACKUP"
log "Backed up old Nginx config to $BACKUP"

if [[ "$OLD_REAL" == /etc/nginx/sites-available/* ]]; then
  NEW_REAL="/etc/nginx/sites-available/$NEW_DOMAIN"
  NEW_ENABLED="/etc/nginx/sites-enabled/$NEW_DOMAIN"
else
  NEW_REAL="/etc/nginx/conf.d/$NEW_DOMAIN.conf"
  NEW_ENABLED="$NEW_REAL"
fi

cp -a "$OLD_REAL" "$NEW_REAL"
# Change only server_name lines first. Keep the existing certificate until
# the new certificate has been issued.
sed -E -i "/server_name/ s/${OLD_DOMAIN//./\\.}/$NEW_DOMAIN/g" "$NEW_REAL"

if [[ "$NEW_REAL" == /etc/nginx/sites-available/* ]]; then
  ln -sfn "$NEW_REAL" "$NEW_ENABLED"
fi

nginx -t
systemctl reload nginx 2>/dev/null || nginx -s reload
log "Temporary $NEW_DOMAIN vhost enabled for ACME validation."

if ! command -v certbot >/dev/null 2>&1; then
  warn "certbot is missing. Install it, then rerun this script."
  exit 1
fi

log "Requesting/renewing a certificate that covers both domains..."
certbot certonly --nginx --non-interactive --agree-tos --register-unsafely-without-email \
  --cert-name "$NEW_DOMAIN" \
  -d "$NEW_DOMAIN" \
  -d "$OLD_DOMAIN"

CERT_DIR="/etc/letsencrypt/live/$NEW_DOMAIN"
test -f "$CERT_DIR/fullchain.pem"
test -f "$CERT_DIR/privkey.pem"

if grep -qE '^[[:space:]]*ssl_certificate[[:space:]]+' "$NEW_REAL"; then
  sed -E -i "s#^[[:space:]]*ssl_certificate[[:space:]]+[^;]+;#    ssl_certificate $CERT_DIR/fullchain.pem;#" "$NEW_REAL"
fi
if grep -qE '^[[:space:]]*ssl_certificate_key[[:space:]]+' "$NEW_REAL"; then
  sed -E -i "s#^[[:space:]]*ssl_certificate_key[[:space:]]+[^;]+;#    ssl_certificate_key $CERT_DIR/privkey.pem;#" "$NEW_REAL"
fi

nginx -t
systemctl reload nginx 2>/dev/null || nginx -s reload

log "Testing the new host locally through Nginx..."
curl --fail --silent --show-error --resolve "$NEW_DOMAIN:443:127.0.0.1" "https://$NEW_DOMAIN/api/health" >/dev/null

log "New domain is healthy. Converting the old domain to a 301 redirect."
cat > "$OLD_REAL" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $OLD_DOMAIN;
    return 301 https://$NEW_DOMAIN\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $OLD_DOMAIN;

    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;

    return 301 https://$NEW_DOMAIN\$request_uri;
}
EOF

nginx -t
systemctl reload nginx 2>/dev/null || nginx -s reload

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

BACKEND_ENV="$APP_DIR/backend/.env"
FRONTEND_ENV="$APP_DIR/frontend/.env"

upsert_env "$BACKEND_ENV" PUBLIC_BASE_URL "https://$NEW_DOMAIN"
upsert_env "$BACKEND_ENV" HOLA_MAPS_WEB_URL "https://$NEW_DOMAIN"
append_origin "$BACKEND_ENV" CORS_ORIGIN "https://$NEW_DOMAIN"
append_origin "$BACKEND_ENV" CORS_ORIGIN "https://$OLD_DOMAIN"
append_origin "$BACKEND_ENV" PUBLIC_API_CORS_ORIGIN "https://$NEW_DOMAIN"
append_origin "$BACKEND_ENV" PUBLIC_API_CORS_ORIGIN "https://$OLD_DOMAIN"
upsert_env "$FRONTEND_ENV" VITE_API_URL "https://$NEW_DOMAIN/api"

log "Production env now uses https://$NEW_DOMAIN"
log "Old domain redirects permanently to the new domain."
