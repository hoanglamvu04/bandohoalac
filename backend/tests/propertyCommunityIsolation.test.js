import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/database/pool.js';
import {
  listCommunityVerificationQueue,
  submitCommunityVerification
} from '../src/services/communityVerification.service.js';

test('property closure reports are never exposed to community verification', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires isolated PG16 test database');
    return;
  }

  const token = randomUUID().replace(/-/g, '');
  const userIds = [];
  let placeId = null;
  let contributionId = null;

  try {
    for (const suffix of ['owner', 'viewer']) {
      const result = await pool.query(
        `INSERT INTO users(name,email,password_hash,role)
         VALUES('Community Isolation QA',$1,'fake-test-hash','USER') RETURNING id`,
        [suffix + '-isolation-' + token + '@example.invalid']
      );
      userIds.push(result.rows[0].id);
    }
    const place = await pool.query(
      `INSERT INTO places(name,slug,category_id,address,location,status,source,created_by)
       VALUES('Property report QA',$1,
         (SELECT id FROM categories WHERE slug='bat-dong-san'),
         'Hòa Lạc', ST_SetSRID(ST_MakePoint(105.52522,21.01354),4326),
         'PUBLISHED','USER',$2) RETURNING id`,
      ['property-report-' + token, userIds[0]]
    );
    placeId = place.rows[0].id;
    const contribution = await pool.query(
      `INSERT INTO contributions(user_id, place_id, type, status, payload)
         VALUES($1,$2,'REPORT_CLOSED','PENDING',$3::jsonb) RETURNING id`,
      [userIds[0], placeId, JSON.stringify({ reason: 'Đã bán' })]
    );
    contributionId = contribution.rows[0].id;

    const queue = await listCommunityVerificationQueue(userIds[1], { limit: 50 });
    assert.equal(queue.some((item) => String(item.id) === String(contributionId)), false);
    await assert.rejects(
      () => submitCommunityVerification({
        contributionId, userId: userIds[1], verdict: 'CONFIRM', reason: 'Đã kiểm tra'
      }),
      (error) => error.statusCode === 403
    );
  } finally {
    if (contributionId) await pool.query('DELETE FROM contributions WHERE id=$1', [contributionId]);
    if (placeId) await pool.query('DELETE FROM places WHERE id=$1', [placeId]);
    for (const userId of userIds) {
      await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    }
  }
});
