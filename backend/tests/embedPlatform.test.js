import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/database/pool.js';
import {
  approveEmbed,
  createApprovedEmbed,
  revokeEmbed,
  rotateEmbed
} from '../src/services/embedPlatform.service.js';

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

function endpoint(path) { return baseUrl + path; }

async function authPolicy(originalUri) {
  return fetch(endpoint('/api/embed/authorize'), {
    headers: { 'X-Original-URI': originalUri }
  });
}

test('embed: applicant request, reviewed origin policy, revocation and rotation', async () => {
  const email = 'embed-test-' + Date.now() + '@example.invalid';
  const createdApps = [];
  let userId;

  try {
    const register = await fetch(endpoint('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Embed App Test', email, password: 'EmbedTest@1234' })
    });
    assert.equal(register.status, 201);
    const identity = await register.json();
    userId = identity.user.id;
    const auth = { Authorization: 'Bearer ' + identity.token };

    const unauthorized = await fetch(endpoint('/api/embed/requests/mine'));
    assert.equal(unauthorized.status, 401);
    const adminList = await fetch(endpoint('/api/admin/embed-applications'), { headers: auth });
    assert.equal(adminList.status, 403);

    const invalid = await fetch(endpoint('/api/embed/requests'), {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appName: 'Malicious origin',
        contactEmail: email,
        origins: ["https://valid.example.com/../", "https://evil.example.com; script-src 'unsafe-inline'"]
      })
    });
    assert.equal(invalid.status, 400);

    const request = await fetch(endpoint('/api/embed/requests'), {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appName: 'HALO HOLA Test',
        contactEmail: email,
        origins: ['https://halohola.vn', 'https://www.halohola.vn'],
        note: 'Partner iframe integration'
      })
    });
    assert.equal(request.status, 201);
    const submitted = (await request.json()).item;
    createdApps.push(submitted.id);
    assert.equal(submitted.status, 'PENDING');
    assert.equal(submitted.embedKey, null);
    assert.equal(submitted.embedUrl, null);

    const tryApprove = await fetch(endpoint('/api/admin/embed-applications/' + submitted.id + '/approve'), {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ validDays: 365 })
    });
    assert.equal(tryApprove.status, 403);

    await assert.rejects(
      approveEmbed({
        id: submitted.id,
        reviewedBy: userId,
        validDays: 365,
        approvedOrigins: ['https://not-requested.example']
      }),
      /Domain duyệt/i
    );

    const approved = await approveEmbed({
      id: submitted.id,
      reviewedBy: userId,
      validDays: 365,
      approvedOrigins: ['https://halohola.vn', 'https://www.halohola.vn']
    });
    assert.equal(approved.status, 'APPROVED');
    assert.match(approved.embedKey, /^he_[a-zA-Z0-9_-]{32}$/);
    assert.match(approved.embedUrl, /\/embed\?key=/);

    const mine = await fetch(endpoint('/api/embed/requests/mine'), { headers: auth });
    assert.equal(mine.status, 200);
    const ownerRecords = (await mine.json()).items;
    assert.equal(ownerRecords.find((app) => app.id === submitted.id)?.embedKey, approved.embedKey);

    const missingKey = await authPolicy('/embed');
    assert.equal(missingKey.status, 403);
    const incorrectKey = await authPolicy('/embed?key=he_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    assert.equal(incorrectKey.status, 403);
    const forbiddenRoute = await authPolicy('/admin?key=' + approved.embedKey);
    assert.equal(forbiddenRoute.status, 403);

    const allowed = await authPolicy('/embed?key=' + encodeURIComponent(approved.embedKey));
    assert.equal(allowed.status, 204);
    assert.equal(
      allowed.headers.get('x-hola-embed-allowed-origins'),
      'https://halohola.vn https://www.halohola.vn'
    );
    assert.match(allowed.headers.get('cache-control') || '', /no-store/i);

    const allowedChild = await authPolicy('/embed/halo?key=' + encodeURIComponent(approved.embedKey));
    assert.equal(allowedChild.status, 204);

    const rotated = await rotateEmbed({
      id: submitted.id,
      validDays: 365,
      reviewedBy: userId
    });
    assert.notEqual(rotated.embedKey, approved.embedKey);
    assert.equal((await authPolicy('/embed?key=' + approved.embedKey)).status, 403);
    assert.equal((await authPolicy('/embed?key=' + rotated.embedKey)).status, 204);

    await pool.query(
      "UPDATE embed_applications SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1",
      [submitted.id]
    );
    assert.equal((await authPolicy('/embed?key=' + rotated.embedKey)).status, 403);

    await pool.query(
      "UPDATE embed_applications SET expires_at = NOW() + INTERVAL '1 day' WHERE id = $1",
      [submitted.id]
    );
    const revoked = await revokeEmbed(submitted.id, userId);
    assert.equal(revoked.status, 'REVOKED');
    assert.equal((await authPolicy('/embed?key=' + rotated.embedKey)).status, 403);
  } finally {
    if (createdApps.length) {
      await pool.query('DELETE FROM embed_applications WHERE id = ANY($1::bigint[])', [createdApps]);
    }
    if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
});

test('embed: direct partner grant returns only approved HTTPS ancestors', async () => {
  let createdId;
  try {
    const actor = await pool.query('SELECT id FROM users LIMIT 1');
    const reviewerId = actor.rows[0]?.id;
    if (!reviewerId) return;

    const grant = await createApprovedEmbed({
      appName: 'Additional Partner App',
      contactEmail: 'contact@example.invalid',
      origins: ['https://another-partner.example', 'https://www.another-partner.example'],
      note: 'Adversarial tests',
      validDays: 90,
      reviewedBy: reviewerId
    });
    createdId = grant.id;

    const response = await authPolicy('/embed/picker?key=' + grant.embedKey);
    assert.equal(response.status, 204);
    const ancestors = response.headers.get('x-hola-embed-allowed-origins');
    assert.equal(ancestors, 'https://another-partner.example https://www.another-partner.example');
    assert.equal(ancestors.includes('*'), false);
    assert.equal(ancestors.includes('halohola.vn'), false);
  } finally {
    if (createdId) await pool.query('DELETE FROM embed_applications WHERE id = $1', [createdId]);
  }
});
