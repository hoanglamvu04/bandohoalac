#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-maps.dothihoalac.vn}"
SNIPPET="/etc/nginx/snippets/hola-maps-security-headers.conf"

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    exec sudo -n env DOMAIN="$DOMAIN" bash "$0"
  fi
  echo "[security] WARN: nginx hardening requires root or passwordless sudo; skipped." >&2
  exit 0
fi

command -v nginx >/dev/null 2>&1 || exit 0

TARGET="$(grep -RIl --include='*' -E "server_name[^;]*${DOMAIN//./\.}" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -n1 || true)"
if [ -z "$TARGET" ]; then
  echo "[security] WARN: active nginx vhost for $DOMAIN not found; skipped." >&2
  exit 0
fi

TARGET="$(readlink -f "$TARGET" 2>/dev/null || printf '%s' "$TARGET")"
mkdir -p /etc/nginx/snippets

cat > "$SNIPPET" <<'EOF'
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-Permitted-Cross-Domain-Policies "none" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" always;
add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
add_header Content-Security-Policy-Report-Only "default-src 'self' https: data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; font-src 'self' data: https:; worker-src 'self' blob:; frame-src 'self' https:;" always;
EOF

if grep -Fq "$SNIPPET" "$TARGET"; then
  nginx -t
  echo "[security] nginx security headers already configured."
  exit 0
fi

BACKUP="${TARGET}.before-security-$(date +%Y%m%d%H%M%S)"
cp -a "$TARGET" "$BACKUP"

python3 - "$TARGET" "$DOMAIN" "$SNIPPET" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
domain = sys.argv[2]
snippet = sys.argv[3]
lines = path.read_text().splitlines()
out = []
inserted = 0

for line in lines:
    out.append(line)
    stripped = line.strip()
    if stripped.startswith("server_name ") and domain in stripped:
        indent = line[:len(line) - len(line.lstrip())]
        out.append(f"{indent}# HOLA_SECURITY_HEADERS_V1")
        out.append(f"{indent}include {snippet};")
        inserted += 1

if not inserted:
    raise SystemExit("No matching server_name line found")

path.write_text("\n".join(out) + "\n")
PY

if ! nginx -t; then
  cp -a "$BACKUP" "$TARGET"
  nginx -t
  echo "[security] WARN: nginx hardening rolled back because config test failed." >&2
  exit 1
fi

systemctl reload nginx 2>/dev/null || nginx -s reload
echo "[security] nginx security headers enabled for $DOMAIN."
