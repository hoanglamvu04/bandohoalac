import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/database/pool.js';
import { createApp } from '../src/app.js';
import {
  feedbackSubmitSchema, feedbackReviewSchema,
  vitalSampleSchema, gradeVital
} from '../src/validators/softLaunch.validators.js';
import {
  listSoftLaunchFeedback, recordSoftLaunchVital,
  reviewSoftLaunchFeedback, softLaunchVitalsOverview
} from '../src/services/softLaunchV1.service.js';

const feedback = {
  category: 'BUG',
  area: 'MAP',
  message: 'Kéo bản đồ trên điện thoại thì lớp địa điểm tải lại liên tục.'
};

test('soft launch rejects PII fields, raw URLs, hidden IDs and invalid performance samples', () => {
  assert.equal(feedbackSubmitSchema.safeParse(feedback).success, true);
  assert.equal(feedbackSubmitSchema.safeParse({ ...feedback, email: 'person@example.com' }).success, false);
  assert.equal(feedbackSubmitSchema.safeParse({ ...feedback, lat: 21.014, lng: 105.5 }).success, false);
  assert.equal(feedbackSubmitSchema.safeParse({ ...feedback, message: 'short' }).success, false);
  assert.equal(feedbackReviewSchema.safeParse({ status: 'IN_REVIEW', note: 'Đang xem', expectedVersion: 1 }).success, true);
  assert.equal(feedbackReviewSchema.safeParse({ status: 'DELETE_ALL', expectedVersion: 1 }).success, false);
  assert.equal(feedbackReviewSchema.safeParse({ status: 'NEW' }).success, false);
  assert.equal(feedbackReviewSchema.safeParse({ status: 'NEW', expectedVersion: 0 }).success, false);
  assert.equal(feedbackReviewSchema.safeParse({ status: 'NEW', expectedVersion: '1' }).success, false);

  const sample = {
    metric: 'LCP', routeGroup: 'MAP',
    device: 'MOBILE', network: '4g', value: 2900
  };
  assert.equal(vitalSampleSchema.safeParse(sample).success, true);
  assert.equal(vitalSampleSchema.safeParse({ ...sample, routePath: '/place/private/123' }).success, false);
  assert.equal(vitalSampleSchema.safeParse({ ...sample, userId: 123 }).success, false);
  assert.equal(vitalSampleSchema.safeParse({ ...sample, value: Infinity }).success, false);
  assert.equal(vitalSampleSchema.safeParse({ ...sample, metric: 'MAP_READY', routeGroup: 'HOME' }).success, false);
  assert.equal(gradeVital('LCP', 2500), 'good');
  assert.equal(gradeVital('LCP', 4000), 'needs_improvement');
  assert.equal(gradeVital('LCP', 5000), 'poor');
  assert.equal(gradeVital('CLS', 0.1), 'good');
  assert.equal(gradeVital('INP', 201), 'needs_improvement');
});

test('guest feedback is private and moderator cannot read Admin launch queue', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('Requires isolated test PostgreSQL');
    return;
  }
  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  let reference = null;
  try {
    const created = await fetch(origin + '/api/soft-launch/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback)
    });
    assert.equal(created.status, 201);
    const item = await created.json();
    assert.equal(item.accepted, true);
    assert.match(item.reference, /^[0-9a-f-]{36}$/i);
    reference = item.reference;

    const stored = await pool.query(
      'SELECT id, category, area, status, version FROM soft_launch_feedback WHERE public_reference=$1',
      [reference]
    );
    assert.equal(stored.rows.length, 1);
    assert.equal(stored.rows[0].status, 'NEW');

    const untrusted = await fetch(origin + '/api/soft-launch/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...feedback, contactEmail: 'sensitive@example.com' })
    });
    assert.equal(untrusted.status, 400);

    const unauth = await fetch(origin + '/api/admin/soft-launch/feedback');
    assert.equal(unauth.status, 401);

    const login = await fetch(origin + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'moderator@holamaps.vn', password: 'Moderator@123' })
    });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    for (const resource of ['/api/admin/soft-launch/feedback', '/api/admin/soft-launch/vitals']) {
      const result = await fetch(origin + resource, {
        headers: { Authorization: 'Bearer ' + token }
      });
      assert.equal(result.status, 403, resource);
    }

    const list = await listSoftLaunchFeedback({ status: 'NEW', limit: 20, page: 1 });
    assert.equal(list.items.some((x) => x.reference === reference), true);
    const actor = await pool.query("SELECT id FROM users WHERE role IN ('ADMIN','MODERATOR') LIMIT 1");
    assert.ok(actor.rows[0], 'test seed needs one moderator or admin');
    const saved = await reviewSoftLaunchFeedback(stored.rows[0].id,
      { status: 'RESOLVED', note: 'Đã kiểm tra trên điện thoại',
        expectedVersion: stored.rows[0].version }, actor.rows[0].id);
    assert.equal(saved.status, 'RESOLVED');
    assert.equal(saved.version, stored.rows[0].version + 1);

    // Two Admin updates start from the same version: only one can win.
    const decisions = await Promise.allSettled([
      reviewSoftLaunchFeedback(stored.rows[0].id,
        { status: 'IN_REVIEW', note: 'Admin A', expectedVersion: saved.version },
        actor.rows[0].id),
      reviewSoftLaunchFeedback(stored.rows[0].id,
        { status: 'DISMISSED', note: 'Admin B', expectedVersion: saved.version },
        actor.rows[0].id)
    ]);
    const winners = decisions.filter((result) => result.status === 'fulfilled');
    const conflicts = decisions.filter((result) => result.status === 'rejected');
    assert.equal(winners.length, 1);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].reason.statusCode, 409);
    assert.equal(conflicts[0].reason.details.code, 'FEEDBACK_VERSION_CONFLICT');
    assert.equal(conflicts[0].reason.details.current.version, saved.version + 1);
    const latest = await pool.query(
      'SELECT status, internal_note, version FROM soft_launch_feedback WHERE id=$1',
      [stored.rows[0].id]
    );
    assert.equal(latest.rows[0].status, winners[0].value.status);
    assert.equal(latest.rows[0].version, saved.version + 1);
    assert.equal(latest.rows[0].internal_note, winners[0].value.status === 'DISMISSED' ? 'Admin B' : 'Admin A');

    const vital = await fetch(origin + '/api/soft-launch/vitals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric: 'LCP', routeGroup: 'MAP', device: 'MOBILE',
        network: '4g', value: 1900 })
    });
    assert.equal(vital.status, 204);

    const forbidden = await fetch(origin + '/api/soft-launch/vitals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric: 'LCP', routeGroup: 'MAP', device: 'MOBILE',
        network: '4g', value: 1900, latitude: 21.012 })
    });
    assert.equal(forbidden.status, 400);

    const overview = await softLaunchVitalsOverview();
    assert.equal(overview.windowHours, 24);
    assert.equal(overview.groups.some((x) => x.metric === 'LCP' &&
      x.routeGroup === 'MAP' && x.samples >= 1), true);
  } finally {
    if (reference) {
      await pool.query('DELETE FROM soft_launch_feedback WHERE public_reference=$1', [reference]);
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Web Vitals aggregate buckets never store individual user records or full paths', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('Requires isolated test PostgreSQL');
    return;
  }
  await recordSoftLaunchVital({
    metric: 'MAP_READY', routeGroup: 'MAP',
    device: 'MOBILE', network: '3g', value: 4200
  });
  const result = await pool.query(
    `SELECT metric, route_group, device, network, samples,
            good, needs_improvement, poor
       FROM soft_launch_vitals_hourly
      WHERE metric='MAP_READY' AND route_group='MAP'
        AND device='MOBILE' AND network='3g'
        AND bucket_hour=date_trunc('hour',now())`
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].samples >= 1, true);
  const names = Object.keys(result.rows[0]);
  assert.equal(names.includes('ip'), false);
  assert.equal(names.includes('user_id'), false);
  assert.equal(names.includes('path'), false);
});
