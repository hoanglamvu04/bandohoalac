-- Idempotent notification key: one 7-day and one 1-day reminder
-- per publication/renewal expiry timestamp, even with repeated cron runs.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_housing_expiry_reminder_dedupe_idx
  ON notifications (
    user_id,
    (data ->> 'placeId'),
    (data ->> 'expiryEpoch'),
    (data ->> 'reminderKey')
  )
  WHERE type = 'HOUSING_EXPIRY_REMINDER';
