import { pool } from '../database/pool.js';

// Idempotent; run daily from cron. Expiry hides the canonical place as well as
// the Housing listing, so all map endpoints stop showing stale adverts.
async function run() {
  const { rows } = await pool.query(`
    WITH expired AS (
      UPDATE housing_listings
         SET listing_status = 'EXPIRED', updated_at = NOW()
       WHERE listing_status = 'ACTIVE'
         AND expires_at IS NOT NULL
         AND expires_at <= NOW()
       RETURNING place_id
    ), archived AS (
      UPDATE places p
         SET status = 'ARCHIVED', updated_at = NOW()
       WHERE p.id IN (SELECT place_id FROM expired)
         AND p.status = 'PUBLISHED'
       RETURNING p.id
    )
    SELECT (SELECT COUNT(*) FROM expired)::int AS expired_count,
           (SELECT COUNT(*) FROM archived)::int AS archived_count
  `);
  console.log('[property-expiry] updated:', rows[0]);
}

run()
  .catch((error) => { console.error('[property-expiry]', error); process.exitCode = 1; })
  .finally(() => pool.end());
