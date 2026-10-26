// Non-destructive adversarial smoke tests. Runs against the ephemeral CI backend
// and CI PostGIS database, NEVER against production/VPS.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/database/pool.js';

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

function url(path) {
  return baseUrl + path;
}

test('unauthenticated protected routes deny access; public health remains public', async () => {
  for (const path of [
    '/api/admin/users',
    '/api/admin/developer-api/keys',
    '/api/admin/coverage-cleanup',
    '/api/admin/halo-sync',
    '/api/auth/security',
    '/api/partner/scanner',
    '/api/partner/reconciliation',
    '/api/notifications',
    '/api/place-claims/me'
  ]) {
    const response = await fetch(url(path));
    assert.equal(response.status, 401, path + ' must not allow anonymous access');
  }

  const health = await fetch(url('/api/health'));
  assert.equal(health.status, 200);
});

test('forged admin JWT and malformed bearer tokens are refused', async () => {
  for (const authorization of [
    'Bearer not.a.jwt',
    'Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwicm9sZSI6IkFETUlOIn0.fake',
    'Basic ZmFrZTpmYWtl'
  ]) {
    const response = await fetch(url('/api/admin/users'), {
      headers: { Authorization: authorization }
    });
    assert.equal(response.status, 401, 'Invalid Authorization: ' + authorization.split(' ')[0]);
  }
});

test('cross-site auth requests are rejected before credentials are checked', async () => {
  const evilOrigin = 'https://untrusted-security-test.example';
  const foreignOrigin = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: evilOrigin
    },
    body: JSON.stringify({
      email: 'nobody@example.invalid',
      password: 'NotARealPassword@123'
    })
  });
  assert.equal(foreignOrigin.status, 403);
  assert.notEqual(foreignOrigin.headers.get('access-control-allow-origin'), evilOrigin);

  const crossSite = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'cross-site'
    },
    body: JSON.stringify({
      email: 'nobody@example.invalid',
      password: 'NotARealPassword@123'
    })
  });
  assert.equal(crossSite.status, 403);

  const noSession = await fetch(url('/api/auth/me'));
  assert.equal(noSession.status, 401);
  assert.match(noSession.headers.get('cache-control') || '', /no-store/);
});

test('SQL-looking search inputs are treated as text, not executed', async () => {
  const search = await fetch(url('/api/places?q=' + encodeURIComponent("' OR 1=1 --")));
  assert.equal(search.status, 200);
  assert.ok(Array.isArray((await search.json()).items));

  const invalidNumeric = await fetch(url(
    '/api/housing?maxRent=' + encodeURIComponent('0 OR 1=1')
  ));
  assert.equal(invalidNumeric.status, 400);

  const invalidSort = await fetch(url('/api/housing?sort=' + encodeURIComponent("rent_asc;DROP TABLE places")));
  assert.equal(invalidSort.status, 400);
});

test('static uploads do not allow directory traversal into environment files', async () => {
  for (const path of [
    '/uploads/%2e%2e%2f%2e%2e%2f.env',
    '/uploads/%2e%2e/%2e%2e/.env'
  ]) {
    const response = await fetch(url(path));
    assert.ok([400, 404].includes(response.status), 'Unexpected status for ' + path);
    const body = await response.text();
    assert.doesNotMatch(body, /DATABASE_URL=|JWT_SECRET=|SECURITY_ENCRYPTION_KEY=/);
  }
});

test('authenticated ordinary user cannot read admin data or modify an unowned place', async () => {
  const email = 'security-audit-' + Date.now() + '-' +
    Math.random().toString(36).slice(2, 8) + '@example.invalid';
  const register = await fetch(url('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Security Audit Test',
      email,
      password: 'RandomSecurityTest@123'
    })
  });
  assert.equal(register.status, 201);
  const identity = await register.json();
  assert.ok(identity.token);
  const headers = { Authorization: 'Bearer ' + identity.token };
  const id = identity.user?.id;

  try {
    const admin = await fetch(url('/api/admin/users'), { headers });
    assert.equal(admin.status, 403);

    const edit = await fetch(url('/api/partner/places/1'), {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0000000000' })
    });
    assert.equal(edit.status, 403);

    const publicProfile = await fetch(url('/api/users/' + id + '/profile'));
    assert.equal(publicProfile.status, 200);
    const profile = (await publicProfile.json()).user;
    assert.ok(profile);
    assert.equal(Object.hasOwn(profile, 'email'), false);
    assert.equal(Object.hasOwn(profile, 'password_hash'), false);
    assert.equal(Object.hasOwn(profile, 'role'), false);
    assert.equal(Object.hasOwn(profile, 'pointsBalance'), false);

    const invalidPhoto = new FormData();
    invalidPhoto.append(
      'photos',
      new Blob([Buffer.from('GIF89a-not-a-png')], { type: 'image/png' }),
      'disguised.png'
    );
    const upload = await fetch(url('/api/contributions'), {
      method: 'POST',
      headers,
      body: invalidPhoto
    });
    assert.equal(upload.status, 400, 'Image header mismatch must be rejected');
  } finally {
    if (id) {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
    }
  }
});
