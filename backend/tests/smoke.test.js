import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/database/pool.js';

let server;
let baseUrl;

before(async () => {
  const app = createApp();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

function url(path) {
  return `${baseUrl}${path}`;
}

test('GET /api/health returns ok', async () => {
  const res = await fetch(url('/api/health'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('GET /api/places returns a list', async () => {
  const res = await fetch(url('/api/places'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
});

test('GET /api/places/nearby with valid params returns 200', async () => {
  const res = await fetch(url('/api/places/nearby?lat=21.005&lng=105.525&radius=5000'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
});

test('GET /api/places/nearby with invalid params returns 400', async () => {
  const res = await fetch(url('/api/places/nearby?lat=not-a-number&lng=105.525'));
  assert.equal(res.status, 400);
});

test('GET /api/housing returns the Housing V2 collection', async () => {
  const res = await fetch(url('/api/housing'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
  assert.equal(typeof body.meta, 'object');
});

test('GET /api/housing validates structured filters', async () => {
  const res = await fetch(url('/api/housing?maxRent=not-a-number'));
  assert.equal(res.status, 400);
});

test('GET /api/housing accepts the partner-only Housing V2 filter', async () => {
  const res = await fetch(url('/api/housing?partnerOnly=true&minAvailableRooms=1&maxArea=40'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
});

test('GET /api/housing supports distance and amenity filters', async () => {
  const res = await fetch(url('/api/housing?maxDistanceFpt=3000&parking=true&sort=distance'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
  assert.ok(body.meta?.fpt);
});

test('auth: register, login, and me flow', async () => {
  const email = `smoke-${Date.now()}@holamaps.vn`;
  const registerRes = await fetch(url('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Test', email, password: 'Smoke@1234' })
  });
  assert.equal(registerRes.status, 201);
  const { token } = await registerRes.json();
  assert.ok(token);

  const meRes = await fetch(url('/api/auth/me'), {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(meRes.status, 200);
  const { user } = await meRes.json();
  assert.equal(user.email, email);
  assert.equal(user.role, 'USER');
});

test('auth: /me without a token is rejected', async () => {
  const res = await fetch(url('/api/auth/me'));
  assert.equal(res.status, 401);
});


test('auth: refresh cookie rotates and returns a new access token', async () => {
  const email = `smoke-refresh-${Date.now()}@holamaps.vn`;
  const registerRes = await fetch(url('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Refresh User', email, password: 'Smoke@1234' })
  });
  assert.equal(registerRes.status, 201);
  const cookie = registerRes.headers.get('set-cookie');
  assert.ok(cookie && cookie.includes('hola_refresh='));

  const refreshRes = await fetch(url('/api/auth/refresh'), {
    method: 'POST',
    headers: {
      Cookie: cookie.split(';')[0],
      Origin: 'http://localhost:5175'
    }
  });
  assert.equal(refreshRes.status, 200);
  const body = await refreshRes.json();
  assert.ok(body.token);
  assert.equal(body.user.email, email);
  assert.ok(refreshRes.headers.get('set-cookie')?.includes('hola_refresh='));
});

test('auth: login with wrong password is rejected', async () => {
  const res = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@holamaps.vn', password: 'wrong-password' })
  });
  assert.equal(res.status, 401);
});

test('contribution permissions: unauthenticated submission is rejected', async () => {
  const res = await fetch(url('/api/contributions'), { method: 'POST' });
  assert.equal(res.status, 401);
});

test('contribution permissions: authenticated but invalid payload is rejected with 400', async () => {
  const email = `smoke-contrib-${Date.now()}@holamaps.vn`;
  const registerRes = await fetch(url('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Contributor', email, password: 'Smoke@1234' })
  });
  const { token } = await registerRes.json();

  const res = await fetch(url('/api/contributions'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'CREATE_PLACE' })
  });
  assert.equal(res.status, 400);
});

test('contribution permissions: a plain USER cannot reach admin moderation routes', async () => {
  const email = `smoke-user-${Date.now()}@holamaps.vn`;
  const registerRes = await fetch(url('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Regular User', email, password: 'Smoke@1234' })
  });
  const { token } = await registerRes.json();

  const res = await fetch(url('/api/admin/contributions'), {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res.status, 403);
});

test('admin: ADMIN without 2FA is directed to security setup', async () => {
  const loginRes = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@holamaps.vn', password: 'Admin@123' })
  });
  assert.equal(loginRes.status, 200);
  const { token } = await loginRes.json();

  const res = await fetch(url('/api/admin/contributions'), {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.details?.code, 'ADMIN_2FA_SETUP_REQUIRED');
});

test('admin: MODERATOR role can list contributions', async () => {
  const loginRes = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'moderator@holamaps.vn', password: 'Moderator@123' })
  });
  assert.equal(loginRes.status, 200);
  const { token } = await loginRes.json();

  const res = await fetch(url('/api/admin/contributions'), {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
});


test('Auto ingestion source registry is seeded by migration', async () => {
  const { rows } = await pool.query(
    `SELECT source_key, enabled
     FROM data_sources
     WHERE source_key IN ('OVERTURE_PLACES','PHOTO_SCAN','FRESHNESS_SWEEP')
     ORDER BY source_key`
  );
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.enabled === true));
});

test('Auto ingestion admin route rejects MODERATOR accounts', async () => {
  const loginRes = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'moderator@holamaps.vn', password: 'Moderator@123' })
  });
  const { token } = await loginRes.json();

  const res = await fetch(url('/api/admin/ingestion'), {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res.status, 403);
});

test('GET /api/leaderboard returns ranked items', async () => {
  const res = await fetch(url('/api/leaderboard'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
});



test('notifications: unauthenticated list is rejected', async () => {
  const res = await fetch(url('/api/notifications'));
  assert.equal(res.status, 401);
});

test('GET /api/leaderboard supports all-time period', async () => {
  const res = await fetch(url('/api/leaderboard?period=all'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.period, 'all');
  assert.ok(Array.isArray(body.items));
});

test('unknown route returns 404', async () => {
  const res = await fetch(url('/api/does-not-exist'));
  assert.equal(res.status, 404);
});


test('Public Integration API: meta exposes v1 read-only contract', async () => {
  const res = await fetch(url('/api/public/v1/meta'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-hola-api-version'), 'v1');
  const body = await res.json();
  assert.equal(body.data.apiVersion, 'v1');
  assert.equal(body.data.readOnly, true);
});

test('Public Integration API: categories returns public taxonomy', async () => {
  const res = await fetch(url('/api/public/v1/categories'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.data.items));
});

test('Public Integration API: place list hides internal workflow fields', async () => {
  const res = await fetch(url('/api/public/v1/places?limit=2'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.data.items));

  const item = body.data.items[0];
  if (item) {
    assert.ok(item.category);
    assert.ok(item.location);
    assert.ok(item.images);
    assert.equal(Object.prototype.hasOwnProperty.call(item, 'createdBy'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(item, 'source'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(item, 'status'), false);
  }
});

test('Public Integration API: GeoJSON bounds returns FeatureCollection', async () => {
  const res = await fetch(url(
    '/api/public/v1/places/geojson?north=21.145&south=20.885&east=105.665&west=105.325'
  ));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.type, 'FeatureCollection');
  assert.ok(Array.isArray(body.features));
});


test('Developer API: OpenAPI schema is public while docs are enabled', async () => {
  const res = await fetch(url('/api/public/v1/openapi.json'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.openapi, '3.0.3');
  assert.equal(body.info.title, 'Hola Maps Developer API');
});

test('Developer API admin routes reject unauthenticated users', async () => {
  const res = await fetch(url('/api/admin/developer-api/overview'));
  assert.equal(res.status, 401);
});
