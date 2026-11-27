import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import cors from 'cors';
import { pool } from '../src/database/pool.js';
import {
  createWa005PullAnalyticsRouter, validWa005ReadKey
} from '../src/integrations/wa005PullAnalytics.routes.js';
import { createXHubAnalyticsRouter } from '../src/integrations/xhubAnalytics.routes.js';
import {
  createWa005ConsentedStore, dateWindow, vietnamDay, wa005MetricFor
} from '../src/services/wa005ConsentedAnalytics.service.js';

const KEY = 'a'.repeat(64);
const SITE_ORIGIN = 'https://maps.dothihoalac.vn';

function event(name = 'page_view', extras = {}) {
  return {
    eventId: randomUUID(), sessionId: randomUUID(), name,
    occurredAt: new Date().toISOString(),
    path: '/map', consent: true, ...extras
  };
}

async function withApp({ enabled = true, key = KEY, store, addCors = true } = {}, callback) {
  const app = express();
  const source = createWa005PullAnalyticsRouter({ enabled, readKey: key, store });
  app.use('/api/xhub/v1/analytics', source.router);
  if (addCors) app.use(cors({ origin: true, credentials: true }));
  app.use('/api/xhub-analytics', express.json({ limit: 16000 }),
    createXHubAnalyticsRouter({
      localEnabled: source.configured, localIngest: source.ingest,
      publicHost: 'maps.dothihoalac.vn'
    }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const root = 'http://127.0.0.1:' + server.address().port;
  const summary = (days = '7', keyValue = KEY, headers = {}) =>
    fetch(root + '/api/xhub/v1/analytics/summary?days=' + days, {
      headers: {
        ...(keyValue === null ? {} : { 'X-XHub-Analytics-Key': keyValue }),
        ...headers
      }
    });
  const push = (events, headers = {}) =>
    fetch(root + '/api/xhub-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SITE_ORIGIN, ...headers },
      body: JSON.stringify({ schemaVersion: 1, events })
    });
  try { await callback({ root, summary, push }); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

const sample = {
  schemaVersion: 1, siteCode: 'bandohoalac', siteHost: 'maps.dothihoalac.vn',
  period: { days: 7, timezone: 'Asia/Ho_Chi_Minh' },
  generatedAt: '2026-11-23T02:00:00.000Z',
  privacy: { consent: 'explicit_opt_in', granularity: 'aggregate_only' },
  metrics: { pageViews: 2, contactClicks: 1, leadSubmissions: 0 },
  daily: [{ day: '2026-11-23', pageViews: 2, contactClicks: 1, leadSubmissions: 0 }]
};

test('WA-005 constant-time READ key requires a separate 64-digit hex secret', () => {
  assert.equal(validWa005ReadKey(KEY, KEY), true);
  assert.equal(validWa005ReadKey(KEY.toUpperCase(), KEY), true);
  assert.equal(validWa005ReadKey('b'.repeat(64), KEY), false);
  assert.equal(validWa005ReadKey('a'.repeat(43), KEY), false);
  assert.equal(validWa005ReadKey('a'.repeat(64), undefined), false);
  assert.equal(validWa005ReadKey(undefined, KEY), false);
  assert.equal(validWa005ReadKey('invalid', 'invalid'), false);
});

test('WA-005 defaults to unavailable, never invents zero totals', async () => {
  await withApp({ enabled: false }, async ({ summary }) => {
    const response = await summary();
    assert.equal(response.status, 503);
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.equal((await response.json()).metrics, undefined);
  });
  await withApp({ key: undefined }, async ({ summary }) => {
    assert.equal((await summary()).status, 503);
  });
  await withApp({ store: {
    readSummary: async () => { throw new Error('No consented event data'); }
  } }, async ({ summary }) => {
    const response = await summary();
    assert.equal(response.status, 503);
    assert.equal(JSON.stringify(await response.json()).includes('No consented event data'), false);
  });
});

test('WA-005 rejects browser-origin, cookies, wrong keys and invalid days before reading data', async () => {
  let reads = 0;
  const store = { readSummary: async (days) => {
    reads += 1; return { ...sample, period: { ...sample.period, days } };
  } };
  await withApp({ store }, async ({ summary, root }) => {
    assert.equal((await summary('7', null)).status, 401);
    assert.equal((await summary('7', 'b'.repeat(64))).status, 401);
    assert.equal((await summary('7', 'a'.repeat(43))).status, 401);
    for (const header of [
      { Origin: SITE_ORIGIN }, { Origin: 'https://malicious.example' },
      { Cookie: 'sid=abc' }, { Referer: SITE_ORIGIN + '/map' },
      { 'Sec-Fetch-Site': 'same-origin' }
    ]) {
      const response = await summary('7', KEY, header);
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
    for (const days of ['0', '8', '91', '365', '7%26raw=true', '7&days=30']) {
      assert.equal((await summary(days)).status, 400);
    }
    assert.equal((await fetch(root + '/api/xhub/v1/analytics/summary', {
      headers: { 'X-XHub-Analytics-Key': KEY }
    })).status, 400);
    const invalidMethod = await fetch(root + '/api/xhub/v1/analytics/summary', {
      method: 'POST', headers: { 'X-XHub-Analytics-Key': KEY }
    });
    assert.equal(invalidMethod.status, 405);
    assert.equal(reads, 0);

    for (const days of ['7', '30', '90']) {
      const response = await summary(days);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control'), /private.*no-store/);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      const body = await response.json();
      assert.equal(body.period.days, Number(days));
      assert.equal(body.siteCode, 'bandohoalac');
      assert.equal(body.siteHost, 'maps.dothihoalac.vn');
      assert.deepEqual(Object.keys(body), [
        'schemaVersion','siteCode','siteHost','period','generatedAt','privacy','metrics','daily'
      ]);
      assert.equal(JSON.stringify(body).includes(KEY), false);
    }
    assert.equal(reads, 3);
  });
});

test('WA-005 rate limits brute force before accessing underlying stats', async () => {
  let reads = 0;
  await withApp({ store: { readSummary: async () => {
    reads += 1; return sample;
  } } }, async ({ summary }) => {
    const codes = [];
    for (let i = 0; i < 41; i++) {
      codes.push((await summary('7', 'b'.repeat(64))).status);
    }
    assert.ok(codes.includes(429), JSON.stringify(codes));
    assert.equal(reads, 0);
  });
});

test('WA-005 Vietnam calendar boundaries and anti-duplicate event mapping', () => {
  assert.equal(vietnamDay('2026-11-23T16:59:59.000Z'), '2026-11-23');
  assert.equal(vietnamDay('2026-11-23T17:00:00.000Z'), '2026-11-24');
  assert.deepEqual(dateWindow(7, new Date('2026-11-23T17:30:00.000Z')),
    { start: '2026-11-18', end: '2026-11-24' });
  assert.deepEqual(dateWindow(30, new Date('2026-11-23T17:30:00.000Z')),
    { start: '2026-10-26', end: '2026-11-24' });
  assert.equal(wa005MetricFor(event('page_view')), 'pageViews');
  assert.equal(wa005MetricFor(event('map_place_view', { path: '/map' })), 'pageViews');
  assert.equal(wa005MetricFor(event('map_place_view', { path: '/place' })), null);
  assert.equal(wa005MetricFor(event('map_directions_click')), 'contactClicks');
  assert.equal(wa005MetricFor(event('contact_click')), 'contactClicks');
  assert.equal(wa005MetricFor(event('lead_submitted')), null);
  assert.equal(wa005MetricFor(event('search_used')), null);
  assert.equal(wa005MetricFor(event('page_view', { consent: false })), null);
});

test('WA-005 response includes valid daily sums only, no raw event fields', async () => {
  const db = { query: async (sql, params) => {
    if (sql.includes('SELECT EXISTS')) return { rows: [{ ready: true }] };
    assert.deepEqual(params, ['2026-11-18', '2026-11-24']);
    return { rows: [
      { day: '2026-11-22', page_views: '3', contact_clicks: '2', lead_submissions: '0' },
      { day: '2026-11-24', page_views: '6', contact_clicks: '4', lead_submissions: '0' }
    ] };
  } };
  const source = createWa005ConsentedStore({
    db, now: () => new Date('2026-11-23T17:30:00.000Z')
  });
  const summary = await source.readSummary(7);
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.generatedAt, '2026-11-23T17:30:00.000Z');
  assert.deepEqual(summary.metrics, {
    pageViews: 9, contactClicks: 6, leadSubmissions: 0
  });
  assert.equal(summary.daily.length, 2);
  assert.deepEqual(Object.keys(summary.daily[0]), [
    'day', 'pageViews', 'contactClicks', 'leadSubmissions'
  ]);
  for (const forbidden of ['ip', 'sessionId', 'visitorId', 'userId', 'email',
    'phone', 'lat', 'lng', 'query', 'form', 'token', 'eventId']) {
    assert.equal(JSON.stringify(summary).includes('"' + forbidden + '"'), false);
  }
});

test('WA-005 PG16: only consented accepted events, no sessions, idempotent counts', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires migrated, isolated PG16 test database');
    return;
  }
  await pool.query('DELETE FROM wa005_consented_event_dedup');
  await pool.query('DELETE FROM wa005_consented_daily_counts');
  const store = createWa005ConsentedStore({ db: pool });
  try {
    await withApp({ store }, async ({ summary, push }) => {
      assert.equal((await summary()).status, 503);

      const views = event('page_view');
      const detail = event('page_view', { path: '/place' });
      const mapPlace = event('map_place_view', {
        path: '/map', entityType: 'place', entityKey: '42'
      });
      const detailPlace = event('map_place_view', {
        path: '/place', entityType: 'place', entityKey: '42'
      });
      const calls = event('contact_click');
      const directions = event('map_directions_click', {
        entityType: 'place', entityKey: '42'
      });
      const unqualifiedLead = event('lead_submitted');

      const initial = [views, detail, mapPlace, detailPlace, calls, directions,
        unqualifiedLead, event('search_used'), event('filter_used')];

      assert.equal((await push([event('page_view', { consent: false })])).status, 400);
      assert.equal((await push([event('page_view', { phone: '0981234567' })])).status, 400);
      assert.equal((await push(initial, { 'Sec-GPC': '1' })).status, 403);
      assert.equal((await push(initial, { DNT: '1' })).status, 403);
      assert.equal((await push(initial, { Origin: 'https://attacker.example' })).status, 403);
      assert.equal((await summary()).status, 503);

      assert.equal((await push(initial)).status, 202);
      assert.equal((await push(initial)).status, 202); // retries must dedup
      const response = await summary();
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.deepEqual(payload.metrics, {
        pageViews: 3, contactClicks: 2, leadSubmissions: 0
      });
      assert.equal(payload.daily.reduce((n, row) => n + row.pageViews, 0), 3);
      assert.ok(payload.daily.every((row) =>
        /^\d{4}-\d{2}-\d{2}$/.test(row.day)));
      assert.equal(JSON.stringify(payload).includes(views.sessionId), false);
      assert.equal(JSON.stringify(payload).includes(views.eventId), false);

      const dbRow = await pool.query(
        'SELECT page_views, contact_clicks, lead_submissions FROM wa005_consented_daily_counts'
      );
      assert.equal(dbRow.rows.length, 1);
      assert.equal(Number(dbRow.rows[0].page_views), 3);
      assert.equal(Number(dbRow.rows[0].contact_clicks), 2);
      assert.equal(Number(dbRow.rows[0].lead_submissions), 0);
      const digests = await pool.query(
        'SELECT encode(event_digest, \'hex\') AS digest FROM wa005_consented_event_dedup'
      );
      assert.equal(digests.rows.length, 5);
      assert.ok(digests.rows.every((row) => /^[a-f0-9]{64}$/.test(row.digest)));
      assert.equal(digests.rows.some((row) => row.digest === views.eventId), false);
    });
  } finally {
    await pool.query('DELETE FROM wa005_consented_event_dedup');
    await pool.query('DELETE FROM wa005_consented_daily_counts');
  }
});

test('WA-005 migration absence and DB failures never return zero or leak errors', async () => {
  const source = createWa005ConsentedStore({
    db: { query: async () => { throw new Error('private SQL password text'); } }
  });
  await withApp({ store: source }, async ({ summary }) => {
    const response = await summary();
    assert.equal(response.status, 503);
    const responseText = await response.text();
    assert.equal(responseText.includes('private SQL password text'), false);
    assert.equal(responseText.includes('pageViews'), false);
  });
});
