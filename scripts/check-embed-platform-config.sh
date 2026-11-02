#!/usr/bin/env bash
set -euo pipefail

SCRIPT="scripts/install-embed-gateway.sh"
HARDEN="scripts/harden-production-security.sh"
DEPLOY=".github/workflows/deploy-vps.yml"

bash -n "$SCRIPT" "$HARDEN"

# Keep hardening for ALL other paths. Only /embed routes may use the
# per-grant dynamic frame-ancestors header returned by auth_request.
grep -Fq 'add_header X-Frame-Options "DENY" always;' "$HARDEN"
grep -Fq 'auth_request /__hola_embed_authorize;' "$SCRIPT"
grep -Fq 'location = /embed {' "$SCRIPT" || grep -Fq 'write_embed_location "= /embed"' "$SCRIPT"
grep -Fq 'write_embed_location "^~ /embed/"' "$SCRIPT"
grep -Fq "Content-Security-Policy \"frame-ancestors 'self'" "$SCRIPT"
grep -Fq 'proxy_set_header X-Original-URI' "$SCRIPT"
grep -Fq 'try_files /index.html =404;' "$SCRIPT"
grep -Fq 'bash scripts/install-embed-gateway.sh' "$DEPLOY"

if grep -Eq 'frame-ancestors[[:space:]]+\*|frame-ancestors[[:space:]]+https:' "$SCRIPT"; then
  echo '[embed] Unsafe static wildcard/wide CSP.' >&2
  exit 1
fi

echo '[embed] PASS: scoped iframe authorization, dynamic CSP and deployment hook.'
