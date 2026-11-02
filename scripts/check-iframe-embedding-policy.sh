#!/usr/bin/env bash
set -euo pipefail

# Regression guard: HALO HOLA must be allowed to frame the map, but every
# other third-party origin should still be rejected by an enforced policy.
SCRIPT="$(dirname "$0")/harden-production-security.sh"
EXPECTED="frame-ancestors 'self' https://halohola.vn https://www.halohola.vn"

if grep -Eq '^[[:space:]]*add_header[[:space:]]+X-Frame-Options[[:space:]]+' "$SCRIPT"; then
  echo "[iframe-policy] ERROR: X-Frame-Options would block cross-origin HALO HOLA embeds." >&2
  exit 1
fi

if ! grep -Fq "add_header Content-Security-Policy \"$EXPECTED\" always;" "$SCRIPT"; then
  echo "[iframe-policy] ERROR: enforced allowlist is missing or too broad." >&2
  exit 1
fi

if ! grep -F "add_header Content-Security-Policy-Report-Only " "$SCRIPT" |
     grep -Fq "$EXPECTED;"; then
  echo "[iframe-policy] ERROR: report-only frame policy contradicts the enforced allowlist." >&2
  exit 1
fi

echo "[iframe-policy] PASS: HALO HOLA-only iframe allowlist; no blocking X-Frame-Options."
