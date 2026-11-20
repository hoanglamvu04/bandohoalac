import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/database/pool.js';
import {
  getPlacesInBoundsCached, invalidatePlaceBoundsCache
} from '../src/services/place.service.js';

const bounds = { west: 105.45, south: 20.95, east: 105.65, north: 21.1, limit: 10 };

test('32 identical cold reads share the page and count queries', async (t) => {
  t.after(invalidatePlaceBoundsCache);
  let finishQuery;
  const pending = new Promise((resolve) => { finishQuery = resolve; });
  const query = t.mock.method(pool, 'query', () => pending);

  const requests = Array.from({ length: 32 }, () => getPlacesInBoundsCached(bounds));
  finishQuery({ rows: [] });
  const results = await Promise.all(requests);

  assert.equal(query.mock.callCount(), 2);
  assert.equal(results.filter(({ cacheStatus }) => cacheStatus === 'MISS').length, 1);
  assert.equal(results.filter(({ cacheStatus }) => cacheStatus === 'HIT').length, 31);
});

test('invalidation detaches old reads without clearing or overwriting newer results', async (t) => {
  t.after(invalidatePlaceBoundsCache);
  const finishCounts = [];
  const query = t.mock.method(pool, 'query', (sql) => {
    if (!sql.startsWith('SELECT COUNT')) return Promise.resolve({ rows: [] });
    return new Promise((resolve) => finishCounts.push((total) => resolve({ rows: [{ total }] })));
  });

  const older = getPlacesInBoundsCached(bounds);
  invalidatePlaceBoundsCache();
  const newer = getPlacesInBoundsCached(bounds);

  finishCounts[0](0);
  assert.equal((await older).total, 0);
  const joined = getPlacesInBoundsCached(bounds);
  assert.equal(query.mock.callCount(), 4);

  finishCounts[1](7);
  assert.equal((await newer).total, 7);
  assert.deepEqual(await joined, { items: [], total: 7, hasMore: true, cacheStatus: 'HIT' });
  assert.deepEqual(await getPlacesInBoundsCached(bounds), await joined);
});

test('a shared database failure is released so the next request can retry', async (t) => {
  t.after(invalidatePlaceBoundsCache);
  const failure = new Error('database temporarily unavailable');
  const query = t.mock.method(pool, 'query', () => Promise.reject(failure));

  const batch = [getPlacesInBoundsCached(bounds), getPlacesInBoundsCached(bounds)];
  const failed = await Promise.allSettled(batch);
  assert.deepEqual(failed, batch.map(() => ({ status: 'rejected', reason: failure })));
  assert.equal(query.mock.callCount(), 2);

  query.mock.mockImplementation(async () => ({ rows: [] }));
  assert.equal((await getPlacesInBoundsCached(bounds)).cacheStatus, 'MISS');
  assert.equal((await getPlacesInBoundsCached(bounds)).cacheStatus, 'HIT');
  assert.equal(query.mock.callCount(), 4);
});

test('loopback HTTP burst returns consistent map results against test PostGIS', async (t) => {
  const connectionString = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== 'test' || !connectionString) {
    t.skip('Requires NODE_ENV=test and isolated loopback PostGIS');
    return;
  }
  const database = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(database.protocol)
      || !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)
      || database.search) {
    t.skip('The load check requires a loopback PostgreSQL URL with no query overrides');
    return;
  }

  const server = createApp().listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const url = new URL('/api/places/bounds', 'http://127.0.0.1:' + server.address().port);
    url.search = new URLSearchParams(bounds);
    const results = await Promise.all(Array.from({ length: 32 }, async () => {
      const started = performance.now();
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000) });
      const body = await response.json();
      return {
        status: response.status,
        cache: response.headers.get('X-Hola-Cache'),
        body,
        elapsedMs: performance.now() - started
      };
    }));

    const expected = results[0].body;
    assert.ok(Array.isArray(expected.items));
    assert.ok(Number.isInteger(expected.total));
    assert.equal(typeof expected.hasMore, 'boolean');
    for (const result of results) {
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, expected);
    }
    assert.equal(results.filter(({ cache }) => cache === 'MISS').length, 1);
    assert.equal(results.filter(({ cache }) => cache === 'HIT').length, 31);
    const latencies = results.map(({ elapsedMs }) => elapsedMs).sort((a, b) => a - b);
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1];
    t.diagnostic('32 loopback HTTP requests, p95 ' + p95.toFixed(1) + ' ms');
  } finally {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
    await pool.end();
  }
});
