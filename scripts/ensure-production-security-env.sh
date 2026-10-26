#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bandohoalac}"
ENV_FILE="$APP_DIR/backend/.env"

upsert_env() {
  local key="$1" value="$2"
  if grep -qE "^[[:space:]]*${key}=" "$ENV_FILE"; then
    sed -E -i "s#^[[:space:]]*${key}=.*#${key}=${value}#" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE" || true

if ! grep -qE '^JWT_SECRET=.{32,}
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

upsert_env JWT_EXPIRES_IN 15m
upsert_env JWT_EXPIRES 15m
upsert_env REFRESH_TOKEN_DAYS 30
upsert_env LOGIN_LOCK_THRESHOLD 8
upsert_env LOGIN_LOCK_MINUTES 15
 "$ENV_FILE"; then
  echo "[security] JWT_SECRET is missing or shorter than 32 characters. Refusing an insecure production deploy." >&2
  exit 1
fi

if ! grep -qE '^DATABASE_URL=.+
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

upsert_env JWT_EXPIRES_IN 15m
upsert_env REFRESH_TOKEN_DAYS 30
upsert_env LOGIN_LOCK_THRESHOLD 8
upsert_env LOGIN_LOCK_MINUTES 15
 "$ENV_FILE"; then
  echo "[security] DATABASE_URL is required in production." >&2
  exit 1
fi

if ! grep -qE '^CORS_ORIGIN=.+
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

upsert_env JWT_EXPIRES_IN 15m
upsert_env REFRESH_TOKEN_DAYS 30
upsert_env LOGIN_LOCK_THRESHOLD 8
upsert_env LOGIN_LOCK_MINUTES 15
 "$ENV_FILE"; then
  echo "[security] CORS_ORIGIN is required in production." >&2
  exit 1
fi

if ! grep -qE '^PUBLIC_BASE_URL=https://.+' "$ENV_FILE"; then
  echo "[security] PUBLIC_BASE_URL must be an HTTPS URL in production." >&2
  exit 1
fi

if ! grep -qE '^SECURITY_ENCRYPTION_KEY=.{32,}
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

upsert_env JWT_EXPIRES_IN 15m
upsert_env REFRESH_TOKEN_DAYS 30
upsert_env LOGIN_LOCK_THRESHOLD 8
upsert_env LOGIN_LOCK_MINUTES 15
 "$ENV_FILE"; then
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

upsert_env JWT_EXPIRES_IN 15m
upsert_env REFRESH_TOKEN_DAYS 30
upsert_env LOGIN_LOCK_THRESHOLD 8
upsert_env LOGIN_LOCK_MINUTES 15
