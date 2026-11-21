import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createXHubAnalyticsRouter, validXHubSiteBatch } from '../src/integrations/xhubAnalytics.routes.js';

const ORIGIN = 'https://maps.dothihoalac.vn';
const SITE_ID = '11111111-1111-4111-8111-111111111111';
const PRIVATE_TOKEN = 'a'.repeat(43);

function event(name = 'page_view', attributes = {}) {
  return {
    eventId: randomUUID(), sessionId: randomUUID(), name,
    occurredAt: new Date().toISOString(),
    path: '/map', consent: true, ...attributes
  };
}
function batch(events = [event()]) {
  return { schemaVersion: 1, events };
}
async function withSiteRouter(options, callback) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/xhub-analytics', createXHubAnalyticsRouter(options));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    return await callback({
      status: async () => fetch(base + '/api/xhub-analytics/status'),
      post: (body, headers = {}) => fetch(base + '/api/xhub-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
        body: JSON.stringify(body)
      })
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('disabled or unprovisioned bridge boots, reports disabled and sends no event', async () => {
  let count = 0;
  await withSiteRouter({
    enabled: true, approved: false, siteId: SITE_ID, siteToken: PRIVATE_TOKEN,
    publicHost: 'maps.dothihoalac.vn',
    send: async () => { count++; return { status: 202 }; }
  }, async ({ status, post }) => {
    const availability = await status();
    assert.deepEqual(await availability.json(), { schemaVersion: 1, enabled: false });
    assert.equal(availability.headers.get('cache-control'), 'no-store');
    assert.equal((await post(batch())).status, 503);
    assert.equal(count, 0);
  });
  await withSiteRouter({ enabled: true, approved: true }, async ({ status, post }) => {
    assert.equal((await status()).status, 200);
    assert.equal((await post(batch())).status, 503);
  });
});

test('strict origin, consent, content and privacy validation block unsafe forwarding', async () => {
  const received = [];
  const options = {
    enabled: true, approved: true, siteId: SITE_ID, siteToken: PRIVATE_TOKEN,
    publicHost: 'maps.dothihoalac.vn',
    send: async (url, request) => {
      received.push({ url, request });
      return { status: 202 };
    }
  };
  await withSiteRouter(options, async ({ post, status }) => {
    assert.equal((await status().then((response) => response.json())).enabled, true);

    assert.equal((await post(batch(), { Origin: 'https://attacker.example' })).status, 403);
    assert.equal((await post(batch(), { Origin: ORIGIN + ':8443' })).status, 403);
    assert.equal((await post(batch(), { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await post(batch(), { 'Sec-GPC': '1' })).status, 403);
    assert.equal((await post(batch(), { DNT: '1' })).status, 403);
    assert.equal((await post(batch([event('page_view', { consent: false })]))).status, 400);
    assert.equal((await post(batch([event('search_used', { query: 'số điện thoại 0987' })]))).status, 400);
    assert.equal((await post(batch([event('page_view', { path: '/map?lat=21&lng=105' })]))).status, 400);
    assert.equal((await post(batch([event('map_place_view', { entityType: 'place', entityKey: '0987654321' })]))).status, 400);
    assert.equal((await post(batch([event('map_place_view', {
      path: '/place', entityType: 'place', entityKey: '42'
    })]))).status, 202);
    assert.equal((await post({ ...batch(), privateText: 'any contact data' })).status, 400);
    assert.equal((await post({ ...batch(), ignored: 'x'.repeat(17000) })).status, 400);
    assert.equal((await post(batch([event('page_view', {
      occurredAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    })]))).status, 400);

    assert.equal(received.length, 1);
    assert.equal(received[0].url,
      'https://hub.holaspace.vn/api/v1/telemetry/sites/' + SITE_ID + '/events');
    assert.equal(received[0].request.headers.Authorization, 'Bearer ' + PRIVATE_TOKEN);
    const forwarded = JSON.parse(received[0].request.body);
    assert.deepEqual(Object.keys(forwarded).sort(), ['events', 'schemaVersion']);
    assert.deepEqual(Object.keys(forwarded.events[0]).sort(),
      ['consent', 'entityKey', 'entityType', 'eventId', 'name',
        'occurredAt', 'path', 'sessionId']);
    assert.equal(JSON.stringify(forwarded).includes('contact data'), false);
  });
});

test('missing Origin is denied and burst is rate-limited before upstream', async () => {
  let count = 0;
  await withSiteRouter({
    enabled: true, approved: true, siteId: SITE_ID, siteToken: PRIVATE_TOKEN,
    publicHost: 'maps.dothihoalac.vn',
    send: async () => { count += 1; return { status: 202 }; }
  }, async ({ post }) => {
    const accepted = [];
    for (let i = 0; i < 26; i++) accepted.push((await post(batch())).status);
    assert.ok(accepted.includes(429));
    assert.ok(count <= 25);
  });
});

test('schema never accepts arbitrary metadata or coordinates', () => {
  assert.equal(validXHubSiteBatch(batch([event('search_used')])), true);
  assert.equal(validXHubSiteBatch(batch([event('filter_used', { lat: 21.01 })])), false);
  assert.equal(validXHubSiteBatch(batch([event('favorite_added')])), false);
  assert.equal(validXHubSiteBatch(batch([event('favorite_added', {
    entityType: 'place', entityKey: '42'
  })])), true);
  assert.equal(validXHubSiteBatch(batch([])), false);
  assert.equal(validXHubSiteBatch(batch(Array.from({ length: 21 }, () => event()))), false);
});
