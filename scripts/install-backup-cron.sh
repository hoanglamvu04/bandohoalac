#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bandohoalac}"
MARKER="# HOLA_MAPS_NIGHTLY_BACKUP"

if ! command -v crontab >/dev/null 2>&1; then
  echo "[backup] crontab is unavailable; skipped." >&2
  exit 0
fi

LINE="17 3 * * * cd $APP_DIR/backend && npm run db:backup >> $APP_DIR/backend/backups/backup.log 2>&1 $MARKER"

(
  crontab -l 2>/dev/null | grep -Fv "$MARKER" || true
  printf '%s\n' "$LINE"
) | crontab -

echo "[backup] nightly verified backup schedule installed."
