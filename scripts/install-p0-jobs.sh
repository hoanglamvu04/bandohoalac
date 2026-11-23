#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/bandohoalac}"
MARKER="# HOLA_MAPS_P0"

[[ -f "$APP_DIR/backend/src/scripts/expireStaleHousingListings.js" ]] || { echo "P0 deployment missing" >&2; exit 1; }
[[ -f "$APP_DIR/backend/src/scripts/matchSavedHousingAlerts.js" ]] || { echo "Housing alerts deployment missing" >&2; exit 1; }
[[ -f "$APP_DIR/scripts/p0-verified-backup.sh" ]] || { echo "P0 backup script missing" >&2; exit 1; }
command -v crontab >/dev/null || { echo "Install cron before launch" >&2; exit 1; }

mkdir -p "$APP_DIR/backend/backups"
chmod 700 "$APP_DIR/backend/backups"

(crontab -l 2>/dev/null | grep -Fv "$MARKER" || true; \
 printf '%s\n' "17 3 * * * APP_DIR=$APP_DIR bash $APP_DIR/scripts/p0-verified-backup.sh >> $APP_DIR/backend/backups/p0-backup.log 2>&1 $MARKER"; \
 printf '%s\n' "5 4 * * * cd $APP_DIR/backend && npm run housing:expire >> $APP_DIR/backend/backups/p0-expiry.log 2>&1 $MARKER"; \
 printf '%s\n' "12 9 * * * cd $APP_DIR/backend && npm run housing:remind >> $APP_DIR/backend/backups/p0-reminders.log 2>&1 $MARKER"; \
 printf '%s\n' "*/10 * * * * cd $APP_DIR/backend && npm run housing:match-alerts >> $APP_DIR/backend/backups/p0-saved-search-alerts.log 2>&1 $MARKER"; \
 printf '%s\n' "45 2 * * * cd $APP_DIR/backend && npm run soft-launch:prune >> $APP_DIR/backend/backups/p0-soft-launch-prune.log 2>&1 $MARKER") | crontab -

echo "[P0] installed feedback retention (02:45), backup (03:17), property expiry (04:05), reminders (09:12), and in-app housing alerts (every 10 min)"
echo "[P0] Configure /etc/hola-maps-backup.env, test backup now, then run launch readiness checks."
