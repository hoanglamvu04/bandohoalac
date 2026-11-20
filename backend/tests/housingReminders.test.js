import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/database/pool.js';
import { remindExpiringProperties } from '../src/services/housingReminders.service.js';

test('expiration reminders are idempotent, two-stage, owner-only and ignore hidden ads', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires isolated PostgreSQL test database');
    return;
  }
  const token = randomUUID().replace(/-/g, '');
  let userId = null;
  let placeId = null;

  try {
    const u = await pool.query(
      `INSERT INTO users(name,email,password_hash,role)
       VALUES('Housing reminder QA',$1,'not-a-real-password-hash','USER') RETURNING id`,
      ['housing-reminder-' + token + '@example.invalid']
    );
    userId = u.rows[0].id;

    const place = await pool.query(
      `INSERT INTO places(name,slug,category_id,address,location,status,source,created_by)
       VALUES('Reminder sample',$1,
         (SELECT id FROM categories WHERE slug='bat-dong-san'),
         'Hòa Lạc',ST_SetSRID(ST_MakePoint(105.52522,21.01354),4326),
         'PUBLISHED','USER',$2) RETURNING id`,
      ['housing-reminder-' + token, userId]
    );
    placeId = place.rows[0].id;
    await pool.query(
      `INSERT INTO housing_listings(place_id, listing_type, property_type,
           total_price_vnd, area_m2, listing_status, expires_at)
       VALUES ($1,'SALE','HOUSE',3500000000,80,'ACTIVE',NOW() + INTERVAL '6 days')`,
      [placeId]
    );

    async function reminders() {
      const result = await pool.query(
        `SELECT data ->> 'reminderKey' AS reminder_key
           FROM notifications
          WHERE user_id=$1 AND type='HOUSING_EXPIRY_REMINDER'
          ORDER BY id`,
        [userId]
      );
      return result.rows.map(row => row.reminder_key);
    }

    await remindExpiringProperties();
    await remindExpiringProperties();
    assert.deepEqual(await reminders(), ['SEVEN_DAYS']);

    await pool.query(
      `UPDATE housing_listings SET expires_at=NOW() + INTERVAL '12 hours'
        WHERE place_id=$1`,
      [placeId]
    );
    await remindExpiringProperties();
    await remindExpiringProperties();
    assert.deepEqual(await reminders(), ['SEVEN_DAYS', 'ONE_DAY']);

    await pool.query(
      `UPDATE places SET status='ARCHIVED' WHERE id=$1`,
      [placeId]
    );
    await pool.query(
      `UPDATE housing_listings SET listing_status='PAUSED',
       expires_at=NOW() + INTERVAL '2 hours' WHERE place_id=$1`,
      [placeId]
    );
    await remindExpiringProperties();
    assert.equal((await reminders()).length, 2);
  } finally {
    if (placeId) await pool.query('DELETE FROM places WHERE id=$1', [placeId]);
    if (userId) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});
