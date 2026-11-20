#!/usr/bin/env bash
# Verified DB + local-media snapshot, copied to independent offsite storage.
# For Cloudinary, configure and test a separate provider-side asset export.
set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-/var/www/bandohoalac}"
BACKUP_ENV_FILE="${HOLA_BACKUP_ENV_FILE:-/etc/hola-maps-backup.env}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backend/backups}"

test -d "$APP_DIR/backend" || { echo "[P0 backup] app dir missing" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cd "$APP_DIR/backend"

npm run db:backup
node src/scripts/backupMedia.js

db="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hola-maps-*.dump' -printf '%T@ %p\n' | sort -rn | head -n 1 | cut -d' ' -f2-)"
media="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hola-maps-media-*.tar.gz' -printf '%T@ %p\n' | sort -rn | head -n 1 | cut -d' ' -f2-)"
test -n "$db" && test -n "$media" || { echo "[P0 backup] missing dump or media archive" >&2; exit 1; }

(cd "$BACKUP_DIR" && sha256sum -c "$(basename "$db").sha256" && sha256sum -c "$(basename "$media").sha256")
pg_restore --list "$db" >/dev/null
tar -tzf "$media" >/dev/null

if [[ ! -r "$BACKUP_ENV_FILE" ]]; then
  echo "[P0 backup] LOCAL snapshots succeeded, but offsite config missing: $BACKUP_ENV_FILE" >&2
  exit 2
fi
# File must be owned by the operator and have permissions 600.
source "$BACKUP_ENV_FILE"
if [[ -z "${HOLA_BACKUP_RCLONE_DEST:-}" ]]; then
  echo "[P0 backup] HOLA_BACKUP_RCLONE_DEST not configured; cannot claim backup readiness" >&2
  exit 2
fi
command -v rclone >/dev/null || { echo "[P0 backup] rclone missing" >&2; exit 2; }

# copy (never sync): do not delete previous disaster-recovery copies.
rclone copy "$BACKUP_DIR" "$HOLA_BACKUP_RCLONE_DEST" \
  --include '*.dump' --include '*.dump.sha256' \
  --include 'hola-maps-media-*.tar.gz' --include 'hola-maps-media-*.tar.gz.sha256'

rclone check "$BACKUP_DIR" "$HOLA_BACKUP_RCLONE_DEST" \
  --one-way --size-only \
  --include "/$(basename "$db")" \
  --include "/$(basename "$media")"

echo "[P0 backup] verified local and offsite snapshots: $(basename "$db"), $(basename "$media")"
