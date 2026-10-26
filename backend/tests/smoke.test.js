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

test('auth: /me without a token is rejected and auth responses are not cached', async () => {
  const res = await fetch(url('/api/auth/me'));
  assert.equal(res.status, 401);
  assert.match(res.headers.get('cache-control') || '', /no-store/i);
});


test('security: cross-site browser auth mutations are blocked', async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://evil.example',
    'Sec-Fetch-Site': 'cross-site'
  };

  const registerRes = await fetch(url('/api/auth/register'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Blocked Cross Site',
      email: `blocked-${Date.now()}@example.com`,
      password: 'Blocked@1234'
    })
  });
  assert.equal(registerRes.status, 403);

  const loginRes = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: 'nobody@example.com',
      password: 'Blocked@1234'
    })
  });
  assert.equal(loginRes.status, 403);
});


test('auth: browser login accepts empty optional 2FA fields', async () => {
  const email = `smoke-browser-login-${Date.now()}@holamaps.vn`;
  const password = 'Smoke@1234';

  const registerRes = await fetch(url('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Browser Login User', email, password })
  });
  assert.equal(registerRes.status, 201);

  const loginRes = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      totpCode: '',
      recoveryCode: ''
    })
  });

  assert.equal(loginRes.status, 200);
  const body = await loginRes.json();
  assert.ok(body.token);
  assert.equal(body.user.email, email);
});


test('privacy: public profile does not expose private account fields', async () => {
  const email = `smoke-public-profile-${Date.now()}@holamaps.vn`;
  const registerRes = await fetch(url('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Private Profile User', email, password: 'Smoke@1234' })
  });
  assert.equal(registerRes.status, 201);
  const registered = await registerRes.json();

  const profileRes = await fetch(url('/api/users/' + registered.user.id + '/profile'));
  assert.equal(profileRes.status, 200);
  const profile = await profileRes.json();

  assert.equal(profile.user.id, registered.user.id);
  assert.equal(profile.user.name, 'Private Profile User');
  assert.equal('email' in profile.user, false);
  assert.equal('role' in profile.user, false);
  assert.equal('pointsBalance' in profile.user, false);
  assert.equal('trustScore' in profile.user, false);
  assert.equal('ctvTrustScore' in profile.user, false);
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


test('upload security: rejects spoofed image bytes', async () => {
  const email = `smoke-upload-${Date.now()}@holamaps.vn`;
  const registerRes = await fetch(url('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Upload User', email, password: 'Smoke@1234' })
  });
  const { token } = await registerRes.json();

  const form = new FormData();
  form.append('type', 'CREATE_PLACE');
  form.append('photos', new Blob(['not-an-image'], { type: 'image/png' }), 'fake.png');

  const res = await fetch(url('/api/contributions'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
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
  const email = `security-admin-${Date.now()}@holamaps.vn`;
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Security Admin', $1, crypt('Admin@12345', gen_salt('bf', 10)), 'ADMIN')`,
    [email]
  );

  const loginRes = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Admin@12345' })
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

test('Housing V3: organic HOLA Rank ignores partner flags and never presents stale rooms as available', async () => {
  const category = await pool.query("SELECT id FROM categories WHERE slug = 'bat-dong-san'");
  assert.ok(category.rows[0], 'Housing category must be seeded.');

  const marker = 'rankv3' + Date.now() + Math.random().toString(36).slice(2, 8);
  const createdIds = [];

  async function createFixture(label, { availability, rooms, ageDays, partner = false, rating = 0 }) {
    const result = await pool.query(
      [
        'INSERT INTO places',
        '(name, slug, description, category_id, address, location, phone, status, rating_avg)',
        "VALUES ($1, $2, 'Phòng trọ có mô tả', $3, 'ĐH FPT Hòa Lạc',",
        "ST_SetSRID(ST_MakePoint(105.52522, 21.01354), 4326), '0900000000', 'PUBLISHED', $4)",
        'RETURNING id'
      ].join(' '),
      ['Phòng trọ ' + marker + ' ' + label, marker + '-' + label, category.rows[0].id, rating]
    );
    const id = result.rows[0].id;
    createdIds.push(id);

    await pool.query(
      [
        'INSERT INTO housing_listings',
        '(place_id, monthly_rent, area_m2, availability_status, available_rooms,',
        'total_rooms, last_verified_at, verification_source)',
        "VALUES ($1, 2000000, 25, $2, $3, 3, NOW() - $4::int * INTERVAL '1 day', 'COMMUNITY')"
      ].join(' '),
      [id, availability, rooms, ageDays]
    );

    if (partner) {
      await pool.query(
        "INSERT INTO place_partners (place_id, status, partner_name) VALUES ($1, 'ACTIVE', 'Rank Test Partner')",
        [id]
      );
    }

    return String(id);
  }

  try {
    const organic = await createFixture('organic', {
      availability: 'AVAILABLE', rooms: 2, ageDays: 1, rating: 1
    });
    const partner = await createFixture('partner', {
      availability: 'AVAILABLE', rooms: 2, ageDays: 1, partner: true, rating: 5
    });
    const stale = await createFixture('stale', {
      availability: 'AVAILABLE', rooms: 1, ageDays: 90
    });
    const full = await createFixture('full', {
      availability: 'FULL', rooms: 0, ageDays: 1, partner: true
    });

    const base = '/api/housing?q=' + encodeURIComponent(marker) + '&sort=recommended';
    const response = await fetch(url(base));
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.meta.rank.mode, 'organic');
    assert.equal(report.meta.rank.paidBoost, false);
    assert.equal(report.meta.rank.freshnessDays, 30);
    assert.equal(report.items.length, 4);

    const byId = new Map(report.items.map((item) => [item.id, item]));
    assert.equal(byId.get(organic).isPartner, false);
    assert.equal(byId.get(partner).isPartner, true);
    assert.equal(byId.get(organic).holaRank.score, byId.get(partner).holaRank.score);
    assert.equal(byId.get(organic).housing.effectiveAvailabilityStatus, 'AVAILABLE');
    assert.equal(byId.get(stale).housing.availabilityStatus, 'AVAILABLE');
    assert.equal(byId.get(stale).housing.effectiveAvailabilityStatus, 'UNKNOWN');
    assert.equal(byId.get(stale).housing.availabilityFresh, false);
    assert.equal(byId.get(full).housing.effectiveAvailabilityStatus, 'FULL');

    const rankedIds = report.items.map((item) => item.id);
    assert.ok(rankedIds.indexOf(organic) < rankedIds.indexOf(stale));
    assert.ok(rankedIds.indexOf(partner) < rankedIds.indexOf(stale));
    assert.ok(rankedIds.indexOf(stale) < rankedIds.indexOf(full));

    const availableRes = await fetch(url(base + '&availableOnly=true'));
    assert.equal(availableRes.status, 200);
    const available = (await availableRes.json()).items.map((item) => item.id);
    assert.equal(available.length, 2);
    assert.ok(available.includes(organic));
    assert.ok(available.includes(partner));
    assert.equal(available.includes(stale), false);

    const minRoomsRes = await fetch(url(base + '&minAvailableRooms=1'));
    assert.equal(minRoomsRes.status, 200);
    const minRooms = (await minRoomsRes.json()).items.map((item) => item.id);
    assert.equal(minRooms.includes(stale), false);

    const unknownRes = await fetch(url(base + '&availability=UNKNOWN'));
    assert.equal(unknownRes.status, 200);
    assert.deepEqual((await unknownRes.json()).items.map((item) => item.id), [stale]);

    const recentRes = await fetch(url(base + '&verifiedWithinDays=7'));
    assert.equal(recentRes.status, 200);
    assert.equal((await recentRes.json()).items.length, 3);
  } finally {
    if (createdIds.length) {
      await pool.query('DELETE FROM places WHERE id = ANY($1::bigint[])', [createdIds]);
    }
  }
});
