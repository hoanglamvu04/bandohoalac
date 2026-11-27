import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createSoftLaunchMetrics, routeGroup } from '../src/services/softLaunchMetrics.service.js';
import { createDatabaseReadinessProbe } from '../src/services/readiness.service.js';

test('soft launch groups have fixed cardinality and exclude secrets from snapshots', () => {
  assert.equal(routeGroup('/api/housing/123/manage'), 'housing');
  assert.equal(routeGroup('/api/places/123'), 'places');
  assert.equal(routeGroup('/api/map-layers'), 'layers');
  assert.equal(routeGroup('/api/admin/users/4'), 'admin');
  assert.equal(routeGroup('/not-an-api/path'), null);

  let now = Date.parse('2026-11-20T08:00:00.000Z');
  const stats = createSoftLaunchMetrics({ now: () => now, random: () => 0, maxSamplesPerMinute: 2 });
  stats.record({ path: '/api/housing/9001?access_token=SECRET_DO_NOT_STORE', statusCode: 500, durationMs: 1600 });
  stats.record({ path: '/api/housing/9002', statusCode: 429, durationMs: 500 });
  stats.record({ path: '/api/places/333', statusCode: 200, durationMs: 100 });
  stats.record({ path: '/api/housing/9003', statusCode: 503, durationMs: 1000 });

  const result = stats.snapshot();
  assert.equal(result.total.requests, 4);
  assert.equal(result.total.serverErrors, 2);
  assert.equal(result.total.rateLimited, 1);
  assert.equal(result.total.slow, 1);
  assert.equal(result.total.sampledRequests <= 2, true);
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups.find((g) => g.group === 'housing').requests, 3);
  assert.equal(JSON.stringify(result).includes('SECRET_DO_NOT_STORE'), false);
  assert.equal(JSON.stringify(result).includes('9001'), false);

  now += 16 * 60_000;
  assert.equal(stats.snapshot().total.requests, 0);
  assert.equal(stats.snapshot().total.p95Ms, null);
});

test('readiness probe is cached and coalesces concurrent requests without exposing DB errors', async () => {
  let now = 1000;
  let calls = 0;
  const ready = createDatabaseReadinessProbe({
    now: () => now,
    queryFn: async () => {
      calls += 1;
      return { rows: [{ ok: 1 }] };
    },
    cacheMs: 500,
    timeoutMs: 50
  });

  const [one, two] = await Promise.all([ready(), ready()]);
  assert.equal(calls, 1);
  assert.deepEqual(one, two);
  assert.equal(one.ok, true);
  await ready();
  assert.equal(calls, 1);
  now += 501;
  await ready();
  assert.equal(calls, 2);

  const failed = createDatabaseReadinessProbe({
    timeoutMs: 30,
    queryFn: async () => { throw new Error('SECRET_DATABASE_PASSWORD'); }
  });
  const bad = await failed();
  assert.equal(bad.ok, false);
  assert.equal(bad.database, 'down');
  assert.equal(JSON.stringify(bad).includes('SECRET_DATABASE_PASSWORD'), false);
});

test('readiness probe times out hanging database queries', async () => {
  const probe = createDatabaseReadinessProbe({
    timeoutMs: 30,
    queryFn: () => new Promise(() => {})
  });
  const result = await probe();
  assert.equal(result.ok, false);
  assert.equal(result.database, 'down');
});

test('public live/ready routes respond and operational metrics require authentication', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const ready = await fetch(base + '/api/ready');
    assert.equal(ready.status, 200);
    assert.equal(ready.headers.get('cache-control'), 'no-store');
    const report = await ready.json();
    assert.equal(report.database, 'up');
    assert.equal('databaseUrl' in report, false);

    const forbidden = await fetch(base + '/api/admin/operations/overview');
    assert.equal(forbidden.status, 401);
    const body = await forbidden.json();
    assert.equal('metrics' in body, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('search-demand metrics retain only a bounded count, not query contents',()=>{
 const stats=createSoftLaunchMetrics({now:()=>1000});
 stats.record({path:'/api/places',statusCode:200,durationMs:1,searchRequest:true});
 stats.record({path:'/api/housing',statusCode:400,durationMs:1,searchRequest:true});
 stats.record({path:'/api/admin',statusCode:200,durationMs:1,searchRequest:true});
 const report=stats.snapshot();
 assert.equal(report.total.searchRequests,2);
 assert.equal(report.total.successfulSearchRequests,1);
 assert.equal(report.groups.find(x=>x.group==='housing').searchRequests,1);
});
