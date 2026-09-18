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

test('admin: ADMIN role can list contributions', async () => {
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
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
});

test('GET /api/leaderboard returns ranked items', async () => {
  const res = await fetch(url('/api/leaderboard'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
});

test('unknown route returns 404', async () => {
  const res = await fetch(url('/api/does-not-exist'));
  assert.equal(res.status, 404);
});
