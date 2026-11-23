import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createXHubWebTracker } from '../../frontend/src/lib/xhub-web-tracker.mjs';
import {
  XHUB_CONSENT_KEY, disableXHubTracking, getXHubConsent,
  publicAnalyticsPath, publicPlaceKey, setXHubConsent,
  trackXHubEvent, trackXHubRoutePageView
} from '../../frontend/src/lib/xhubAnalytics.js';

function browserHarness({ ready = true, privacy = null } = {}) {
  const stored = new Map();
  const traffic = [];
  const window = {
    crypto: { randomUUID },
    navigator: { globalPrivacyControl: privacy === 'gpc', doNotTrack: privacy === 'dnt' ? '1' : '0' },
    location: { pathname: '/map', search: '?utm_source=someone%40email.test&lat=21.2' },
    document: { referrer: 'https://example.com/contact?email=secret@example.com' },
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: (key) => stored.delete(key)
    },
    fetch: async (url, options) => {
      traffic.push({ url, options });
      if (url.endsWith('/status')) return {
        ok: true, json: async () => ({ schemaVersion: 1, enabled: ready })
      };
      return { ok: true, status: 202 };
    }
  };
  return { window, traffic, stored };
}

test('no consent means no network, including readiness; granting sends schema v1 only', async () => {
  const harness = browserHarness();
  globalThis.window = harness.window;
  disableXHubTracking();

  assert.equal(getXHubConsent(), 'unset');
  assert.equal(await trackXHubRoutePageView('/map'), false);
  assert.equal(await trackXHubEvent('search_used'), false);
  assert.equal(harness.traffic.length, 0);

  assert.equal(setXHubConsent('granted'), true);
  assert.equal(harness.stored.get(XHUB_CONSENT_KEY), 'granted');
  assert.equal(await trackXHubRoutePageView('/map'), true);
  assert.equal(await trackXHubRoutePageView('/map'), false);
  assert.equal(await trackXHubEvent('filter_used'), true);

  const posts = harness.traffic.filter((request) => request.options?.method === 'POST');
  assert.equal(posts.length, 2);
  const payload = JSON.parse(posts[0].options.body);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.events[0].consent, true);
  assert.equal(payload.events[0].path, '/map');
  assert.equal(payload.events[0].name, 'page_view');
  assert.equal(payload.events[0].utmSource, undefined);
  assert.equal(payload.events[0].referrerHost, undefined);
  assert.equal(JSON.stringify(payload).includes('lat='), false);
  assert.equal(JSON.stringify(payload).includes('someone'), false);
  assert.equal(posts[0].options.credentials, 'omit');
  assert.equal(posts[0].url, '/api/xhub-analytics');

  const count = harness.traffic.length;
  assert.equal(setXHubConsent('denied'), true);
  assert.equal(await trackXHubEvent('filter_used'), false);
  assert.equal(harness.traffic.length, count);
  delete globalThis.window;
});

test('public place events have only valid public entity keys, never GPS or account identity', async () => {
  const harness = browserHarness();
  globalThis.window = harness.window;
  disableXHubTracking();
  setXHubConsent('granted');

  for (const id of [41, 42, 43]) {
    harness.window.location.pathname = '/place/' + id;
    assert.equal(await trackXHubEvent('map_place_view', {
      entityType: 'place', entityKey: String(id)
    }), true);
  }
  assert.equal(await trackXHubEvent('map_place_view', {
    entityType: 'place', entityKey: 'bad@example.com'
  }), false);
  assert.equal(publicPlaceKey('42'), '42');
  assert.equal(publicPlaceKey('0912345678abc'), null);
  assert.equal(publicAnalyticsPath('/admin/contributions'), null);
  assert.equal(publicAnalyticsPath('/place/42'), '/place');
  assert.equal(publicAnalyticsPath('/dia-diem/cafe-a'), '/dia-diem');

  const events = harness.traffic.filter((v) => v.options?.method === 'POST')
    .flatMap((v) => JSON.parse(v.options.body).events);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((e) => e.entityKey), ['41', '42', '43']);
  assert.ok(events.every((e) => e.path === '/place' && e.entityType === 'place'));
  assert.ok(events.every((e) => !('lat' in e) && !('lng' in e) && !('userId' in e)));
  disableXHubTracking();
  delete globalThis.window;
});

test('GPC/DNT and missing approved source fail closed', async () => {
  for (const privacy of ['gpc', 'dnt']) {
    const harness = browserHarness({ privacy });
    globalThis.window = harness.window;
    disableXHubTracking();
    assert.equal(setXHubConsent('granted'), false);
    assert.equal(await trackXHubEvent('page_view'), false);
    assert.equal(harness.traffic.length, 0);
  }
  const harness = browserHarness({ ready: false });
  globalThis.window = harness.window;
  disableXHubTracking();
  assert.equal(setXHubConsent('granted'), true);
  assert.equal(await trackXHubRoutePageView('/map'), false);
  assert.deepEqual(harness.traffic.map((x) => x.url), ['/api/xhub-analytics/status']);
  disableXHubTracking();
  delete globalThis.window;
});

test('copied browser SDK and HOLA adapter contain no server token or bearer header', async () => {
  const paths = [
    '../../frontend/src/lib/xhubAnalytics.js',
    '../../frontend/src/lib/xhub-web-tracker.mjs',
    '../../frontend/src/components/XHubAnalyticsConsent.jsx'
  ];
  for (const p of paths) {
    const text = await readFile(new URL(p, import.meta.url), 'utf8');
    assert.equal(text.includes('XHUB_WEB_ANALYTICS_SITE_TOKEN'), false);
    assert.equal(text.includes('Authorization: Bearer'), false);
  }
});

test('WA-002 drains newly queued consented events after a busy successful flush', async () => {
  const root = {
    crypto: { randomUUID },
    navigator: { doNotTrack: '0' },
    location: { pathname: '/place', search: '' },
    document: { referrer: '' }
  };
  const batches = [];
  let unlockFirst;
  const firstGate = new Promise((resolve) => { unlockFirst = resolve; });
  const sdk = createXHubWebTracker({
    root, hasConsent: () => true,
    send: async (_url, options) => {
      const batch = JSON.parse(options.body).events;
      batches.push(batch);
      if (batches.length === 1) await firstGate;
      return { ok: true };
    }
  });
  assert.equal(sdk.track('page_view'), true);
  const firstFlush = sdk.flush();
  assert.equal(sdk.track('map_place_view', {
    entityType: 'place', entityKey: '42'
  }), true);
  assert.deepEqual(await sdk.flush(), { sent: 0 }, 'busy flush cannot race');
  unlockFirst();
  assert.deepEqual(await firstFlush, { sent: 1 });
  // The completion of the first response should launch the queued batch.
  for (let i = 0; i < 40 && (batches.length !== 2 || sdk.pending()); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3));
  }
  assert.equal(batches.length, 2);
  assert.equal(sdk.pending(), 0);
  assert.deepEqual(batches.flat().map((event) => event.name),
    ['page_view', 'map_place_view']);
  assert.equal(batches[1][0].entityKey, '42');
  assert.ok(batches.flat().every((event) => event.consent === true));
});

test('WA-002 never retries a failed flush in a busy loop or after opt-out', async () => {
  let attempts = 0;
  let consent = true;
  const sdk = createXHubWebTracker({
    root: {
      crypto: { randomUUID },
      navigator: { doNotTrack: '0' },
      location: { pathname: '/place', search: '' },
      document: { referrer: '' }
    },
    hasConsent: () => consent,
    send: async () => { attempts += 1; return { ok: false }; }
  });
  sdk.track('page_view');
  assert.deepEqual(await sdk.flush(), { sent: 0 });
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(attempts, 1, 'failed send must remain deferred');
  assert.equal(sdk.pending(), 1);
  consent = false;
  sdk.disable();
  assert.equal(sdk.pending(), 0);
  assert.equal(sdk.track('map_place_view', {
    entityType: 'place', entityKey: '43'
  }), false);
  assert.equal(attempts, 1);
});
