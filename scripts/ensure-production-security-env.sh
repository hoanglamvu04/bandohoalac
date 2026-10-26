#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bandohoalac}"
ENV_FILE="$APP_DIR/backend/.env"

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE" || true

if ! grep -qE '^SECURITY_ENCRYPTION_KEY=.{32,}$' "$ENV_FILE"; then
  command -v openssl >/dev/null 2>&1 || {
    echo "[security] openssl is required to initialize the encryption key." >&2
    exit 1
  }
  KEY="$(openssl rand -hex 32)"
  if grep -qE '^SECURITY_ENCRYPTION_KEY=' "$ENV_FILE"; then
    sed -i -E "s#^SECURITY_ENCRYPTION_KEY=.*#SECURITY_ENCRYPTION_KEY=$KEY#" "$ENV_FILE"
  else
    printf 'SECURITY_ENCRYPTION_KEY=%s\n' "$KEY" >> "$ENV_FILE"
  fi
  echo "[security] initialized dedicated encryption key."
else
  echo "[security] dedicated encryption key already configured."
fi
