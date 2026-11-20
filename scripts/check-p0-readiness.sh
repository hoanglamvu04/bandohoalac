#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/bandohoalac}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backend/backups}"
export BACKUP_DIR
BACKUP_ENV_FILE="${HOLA_BACKUP_ENV_FILE:-/etc/hola-maps-backup.env}"

cd "$APP_DIR"
command -v crontab >/dev/null || { echo "[P0] cron missing" >&2; exit 1; }
crontab -l | grep -q 'HOLA_MAPS_P0' || { echo "[P0] nightly jobs not installed" >&2; exit 1; }

db="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hola-maps-*.dump' -mmin -2160 -printf '%T@ %p\n' | sort -rn | head -n 1 | cut -d' ' -f2-)"
media="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hola-maps-media-*.tar.gz' -mmin -2160 -printf '%T@ %p\n' | sort -rn | head -n 1 | cut -d' ' -f2-)"
test -n "$db" && test -n "$media" || { echo "[P0] recent DB or photo archive missing" >&2; exit 1; }
(cd "$BACKUP_DIR" && sha256sum -c "$(basename "$db").sha256" && sha256sum -c "$(basename "$media").sha256")
pg_restore --list "$db" >/dev/null
tar -tzf "$media" >/dev/null

test -r "$BACKUP_ENV_FILE" || { echo "[P0] offsite configuration missing" >&2; exit 1; }
source "$BACKUP_ENV_FILE"
test -n "${HOLA_BACKUP_RCLONE_DEST:-}" || { echo "[P0] offsite remote is required" >&2; exit 1; }
command -v rclone >/dev/null || { echo "[P0] rclone is required" >&2; exit 1; }
for local_file in "$db" "$media"; do
  expected="$(sha256sum "$local_file" | cut -d ' ' -f1)"
  actual="$(rclone cat "$HOLA_BACKUP_RCLONE_DEST/$(basename "$local_file")" | sha256sum | cut -d ' ' -f1)"
  [[ "$expected" == "$actual" ]] || { echo "[P0] remote checksum mismatch for $(basename "$local_file")" >&2; exit 1; }
done

curl --fail --silent --show-error --max-time 12 https://maps.dothihoalac.vn/api/health >/dev/null
(cd backend && node src/scripts/publicLaunchAudit.js)
echo "[P0] operational readiness checks passed; a manual restore drill and real-device acceptance are still mandatory."
