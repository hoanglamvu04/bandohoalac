import { pool } from '../database/pool.js';

// Daily run: at most two notices per publication/renewal, with DB-level
// idempotency even if cron jobs overlap or are retried after a timeout.
export async function remindExpiringProperties(client = pool) {
  const { rows } = await client.query(`
    WITH due AS (
      SELECT p.created_by AS user_id, p.id AS place_id,
             p.name AS place_name, hl.expires_at,
             CASE WHEN hl.expires_at <= NOW() + INTERVAL '1 day'
                  THEN 'ONE_DAY' ELSE 'SEVEN_DAYS' END AS reminder_key
      FROM housing_listings hl
      JOIN places p ON p.id = hl.place_id
      WHERE hl.property_type IS NOT NULL
        AND hl.listing_status = 'ACTIVE'
        AND p.status = 'PUBLISHED'
        AND p.created_by IS NOT NULL
        AND hl.expires_at IS NOT NULL
        AND hl.expires_at > NOW()
        AND hl.expires_at <= NOW() + INTERVAL '7 days'
    )
    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT due.user_id, 'HOUSING_EXPIRY_REMINDER',
           'Tin bất động sản cần xác nhận lại',
           CASE WHEN due.reminder_key = 'ONE_DAY'
             THEN 'Tin "' || due.place_name ||
                  '" sắp hết hạn trong 24 giờ. Hãy xác nhận còn hiệu lực để không bị ẩn khỏi bản đồ.'
             ELSE 'Tin "' || due.place_name ||
                  '" sắp hết hạn trong 7 ngày. Hãy xác nhận lại thông tin trước khi hết hạn.'
           END,
           jsonb_build_object(
             'placeId', due.place_id::text,
             'expiryEpoch', (EXTRACT(EPOCH FROM due.expires_at)::bigint)::text,
             'reminderKey', due.reminder_key,
             'url', '/tin-bat-dong-san-cua-toi'
           )
    FROM due
    ON CONFLICT DO NOTHING
    RETURNING id
  `);
  return rows.length;
}
