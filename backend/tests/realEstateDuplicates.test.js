import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/database/pool.js';
import { approveContribution } from '../src/services/admin.service.js';
import {
  normalizePropertyPhone, rankPropertyCandidate, findNearbyPropertyCandidates
} from '../src/services/realEstateDuplicates.service.js';

const sample = {
  location: { lat: 21.01354, lng: 105.52522 },
  place: {
    name: 'Nhà phố 3 tầng gần FPT',
    phone: '0987654321',
    realEstate: { transactionType: 'SALE', propertyType: 'HOUSE' }
  }
};

test('phone and title comparisons do not confuse different units on the same plot', () => {
  assert.equal(normalizePropertyPhone('+84 987 654 321'), '0987654321');
  const exact = rankPropertyCandidate({
    id: 1, source: 'PUBLISHED', name: 'Nha pho 3 tang gan FPT',
    phone: '+84 987 654 321', distanceM: 12
  }, sample.place);
  assert.equal(exact.risk, 'LIKELY_DUPLICATE');
  assert.equal(exact.samePhone, true);
  assert.equal(exact.sameTitle, true);

  const nextUnit = rankPropertyCandidate({
    id: 2, source: 'PENDING', name: 'Căn hộ 203', phone: '0911111111',
    distanceM: 0
  }, sample.place);
  assert.equal(nextUnit.risk, 'NEARBY');
  assert.equal(nextUnit.samePhone, false);
  assert.equal(nextUnit.sameTitle, false);
  assert.equal(rankPropertyCandidate({
    id: 3, source: 'PENDING', name: 'Nhà phố khác',
    phone: '0987654321', distanceM: 80
  }, sample.place).risk, 'REVIEW');
});

test('duplicate suggestions omit self, combine both sources, sort by risk', async () => {
  const queries = [];
  const stub = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (queries.length === 1) {
        return { rows: [
          { id: 901, name: 'Lô khác', phone: '0911111111', address: 'Hòa Lạc', distance_m: 4 }
        ] };
      }
      return { rows: [
        { contribution_id: 902, name: 'Nha pho 3 tang gan FPT',
          phone: '+84 987654321', address: 'Hòa Lạc', distance_m: 12 }
      ] };
    }
  };
  const result = await findNearbyPropertyCandidates({
    contributionId: 903, payload: sample, client: stub
  });
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[1].params, [105.52522, 21.01354, 100, 903, 12]);
  assert.equal(result.items[0].source, 'PENDING');
  assert.equal(result.items[0].risk, 'LIKELY_DUPLICATE');
  assert.equal(result.items[1].source, 'PUBLISHED');
  assert.equal(result.items[1].risk, 'NEARBY');
  assert.equal(result.requiresReview, true);
});

test('invalid locations never call the nearby-location query', async () => {
  let calls = 0;
  const result = await findNearbyPropertyCandidates({
    contributionId: 1,
    payload: { ...sample, location: { lat: 'bad', lng: 105.52522 } },
    client: { query() { calls += 1; throw new Error('must not query'); } }
  });
  assert.deepEqual(result.items, []);
  assert.equal(calls, 0);
});

test('PostGIS matches published and pending nearby properties while excluding the current review', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires isolated PG16 test database');
    return;
  }
  const nonce = randomUUID().replace(/-/g, '');
  const refs = { published: null, pending: null, current: null, owner: null };
  try {
    const owner = await pool.query(
      `INSERT INTO users(name,email,password_hash,role)
       VALUES('Property Duplicate QA',$1,'test-hash-only','USER') RETURNING id`,
      ['duplicate-' + nonce + '@example.invalid']
    );
    refs.owner = owner.rows[0].id;
    const place = await pool.query(
      `INSERT INTO places(name,slug,category_id,address,phone,location,status,source,created_by)
       VALUES('Nha pho 3 tang gan FPT',$1,
              (SELECT id FROM categories WHERE slug='bat-dong-san'),
              'Hòa Lạc', '+84 987 654 321',
              ST_SetSRID(ST_MakePoint(105.52522,21.01354),4326),
              'PUBLISHED','USER',$2)
       RETURNING id`,
      ['property-duplicate-' + nonce, refs.owner]
    );
    refs.published = Number(place.rows[0].id);
    for (const entry of ['pending', 'current']) {
      const payload = entry === 'pending'
        ? { ...sample, place: { ...sample.place, name: 'Căn hộ 203', phone: '0911111111' } }
        : sample;
      const inserted = await pool.query(
        `INSERT INTO contributions(user_id,type,status,payload)
         VALUES($1,'CREATE_PLACE','PENDING',$2::jsonb) RETURNING id`,
        [refs.owner, JSON.stringify(payload)]
      );
      refs[entry] = Number(inserted.rows[0].id);
    }
    const result = await findNearbyPropertyCandidates({
      contributionId: refs.current, payload: sample
    });
    assert.ok(result.items.some((x) =>
      x.id === refs.published && x.source === 'PUBLISHED' && x.risk === 'LIKELY_DUPLICATE'
    ));
    const rawPending = await pool.query(
      `SELECT id, status, type, payload #>> '{place,categorySlug}' AS category,
              jsonb_typeof(payload #> '{location,lng}') AS lng_type,
              jsonb_typeof(payload #> '{location,lat}') AS lat_type
         FROM contributions WHERE id=$1`, [refs.pending]
    );
    assert.ok(result.items.some((x) =>
      x.id === refs.pending && x.source === 'PENDING'
    ), 'pending candidate not found: ' + JSON.stringify({
      expectedId: refs.pending,
      returned: result.items,
      stored: rawPending.rows
    }));
    assert.equal(result.items.some((x) =>
      x.id === refs.current && x.source === 'PENDING'
    ), false);
    // Direct API approval attempts must not bypass the human review gate.
    await assert.rejects(
      () => approveContribution(refs.current, { id: refs.owner, role: 'ADMIN' }, {}),
      (error) => error.statusCode === 409 &&
        error.details?.code === 'PROPERTY_NEARBY_REVIEW_REQUIRED'
    );
    const unchanged = await pool.query(
      'SELECT status, place_id FROM contributions WHERE id=$1', [refs.current]
    );
    assert.equal(unchanged.rows[0].status, 'PENDING');
    assert.equal(unchanged.rows[0].place_id, null);
  } finally {
    for (const id of [refs.pending, refs.current]) {
      if (id) await pool.query('DELETE FROM contributions WHERE id=$1', [id]);
    }
    if (refs.published) await pool.query('DELETE FROM places WHERE id=$1', [refs.published]);
    if (refs.owner) await pool.query('DELETE FROM users WHERE id=$1', [refs.owner]);
  }
});
