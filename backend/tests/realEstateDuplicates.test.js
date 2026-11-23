import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/database/pool.js';
import { approveContribution } from '../src/services/admin.service.js';
import {
  normalizePropertyPhone, normalizePropertyTitle, propertyTitleSimilarity,
  propertyUnitKey, rankPropertyCandidate, isBlockingExactPropertyDuplicate,
  findNearbyPropertyCandidates, scanPendingPropertyRiskQueue
} from '../src/services/realEstateDuplicates.service.js';

const sample = {
  location: { lat: 21.01354, lng: 105.52522 },
  place: {
    name: 'Nhà phố 3 tầng gần FPT',
    categorySlug: 'bat-dong-san',
    address: 'Hòa Lạc',
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


test('Data Trust V4 recognizes explicit transaction/type conflicts and only hard-blocks exact structured duplicates', () => {
  const submission = {
    name: 'Nhà phố 3 tầng gần FPT',
    phone: '0987654321',
    realEstate: {
      transactionType: 'SALE', propertyType: 'HOUSE',
      areaM2: 100, totalPriceVnd: 3000000000
    }
  };
  const candidate = {
    name: 'Nha pho - 3 tang gan FPT!', phone: '+84 987 654 321',
    listingType: 'SALE', propertyType: 'HOUSE',
    areaM2: 101, totalPriceVnd: 3020000000, distanceM: 12
  };
  assert.equal(isBlockingExactPropertyDuplicate(candidate, submission), true,
    'accents/punctuation alone cannot bypass the final exact-duplicate guard');

  const rented = {
    ...candidate, listingType: 'RENT',
    totalPriceVnd: null, monthlyRent: 10000000
  };
  const rentRisk = rankPropertyCandidate(rented, submission);
  assert.equal(rentRisk.risk, 'REVIEW', 'one agent may list sale and rent at the same address');
  assert.equal(rentRisk.differentTransaction, true);
  assert.ok(rentRisk.evidence.includes('DIFFERENT_TRANSACTION'));
  assert.equal(isBlockingExactPropertyDuplicate(rented, submission), false);

  const apartment = { ...candidate, propertyType: 'APARTMENT' };
  const typeRisk = rankPropertyCandidate(apartment, submission);
  assert.equal(typeRisk.risk, 'REVIEW');
  assert.equal(typeRisk.differentPropertyType, true);
  assert.ok(typeRisk.evidence.includes('DIFFERENT_PROPERTY_TYPE'));
  assert.equal(isBlockingExactPropertyDuplicate(apartment, submission), false);

  assert.equal(isBlockingExactPropertyDuplicate({
    ...candidate, name: 'Căn 102 tòa A'
  }, { ...submission, name: 'Căn 101 tòa A' }), false);
  assert.equal(isBlockingExactPropertyDuplicate({ ...candidate, areaM2: 140 }, submission), false);
  assert.equal(isBlockingExactPropertyDuplicate({
    ...candidate, totalPriceVnd: 4500000000
  }, submission), false);
  assert.equal(isBlockingExactPropertyDuplicate({
    ...candidate, distanceM: 27
  }, submission), false);
  assert.equal(isBlockingExactPropertyDuplicate({
    ...candidate, phone: '0912345678'
  }, submission), false);

  const unrelated = rankPropertyCandidate({
    ...rented, phone: '0912345678'
  }, submission);
  assert.equal(unrelated.risk, 'NEARBY',
    'conflicting sale/rent with no other corroboration is just a nearby listing');
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

test('Data Trust V3 compares punctuation/accent-insensitive titles and unit numbers', () => {
  assert.equal(normalizePropertyTitle('  NHÀ PHỐ - gần FPT!  '), 'nha pho gan fpt');
  assert.equal(propertyTitleSimilarity('Nhà phố gần FPT', 'Nha pho gan FPT'), 1);
  assert.ok(propertyTitleSimilarity('Nhà phố 3 tầng gần FPT',
    'Bán nhà phố 3 tầng gần FPT') >= 0.78);
  assert.ok(propertyTitleSimilarity('Đất 120 m² gần FPT',
    'Phòng trọ cạnh ĐHQG') < 0.5);
  assert.equal(propertyUnitKey('Căn 101 ở Hòa Lạc'), 'can:101');
  assert.equal(propertyUnitKey('Phòng số 203 tại ĐHQG'), 'phong:203');
  assert.equal(propertyUnitKey('Lô 28 Khu CNC'), 'lo:28');
  assert.equal(propertyUnitKey('Nhà phố 3 tầng gần FPT'), null);
});

test('Data Trust V3 highlights comparable area/type/price, but does not auto-hide', () => {
  const reference = {
    name: 'Nhà phố 3 tầng gần FPT',
    phone: '0987654321',
    realEstate: {
      transactionType: 'SALE', propertyType: 'HOUSE',
      areaM2: 100, totalPriceVnd: 3000000000
    }
  };
  const similar = rankPropertyCandidate({
    id: 11, source: 'PUBLISHED',
    name: 'Nha pho 3 tang gan FPT', phone: '+84 987654321',
    listingType: 'SALE', propertyType: 'HOUSE',
    areaM2: 101, totalPriceVnd: 3020000000, distanceM: 13
  }, reference);
  assert.equal(similar.risk, 'LIKELY_DUPLICATE');
  assert.equal(similar.titleSimilarity, 1);
  assert.equal(similar.samePropertyType, true);
  assert.equal(similar.similarArea, true);
  assert.equal(similar.similarPrice, true);
  assert.equal(similar.differentUnit, false);
  assert.ok(similar.confidence >= 75);
  assert.ok(similar.evidence.includes('SAME_CONTACT'));
  assert.ok(similar.evidence.includes('SIMILAR_AREA'));
  assert.equal(JSON.stringify(similar.evidence).includes('0987654321'), false);

  const different = rankPropertyCandidate({
    id: 12, source: 'PENDING',
    name: 'Nha pho 3 tang gan FPT', phone: '0987654321',
    listingType: 'SALE', propertyType: 'HOUSE',
    areaM2: 245, totalPriceVnd: 5600000000, distanceM: 10
  }, reference);
  assert.equal(different.risk, 'REVIEW',
    'strongly different price and area require human review, not likely duplicate');
  assert.equal(different.conflictingArea, true);
  assert.equal(different.conflictingPrice, true);
  assert.ok(different.evidence.includes('DIFFERENT_AREA'));
  assert.ok(different.evidence.includes('DIFFERENT_PRICE'));
  assert.ok(different.confidence < similar.confidence);
});

test('Data Trust V3 never conflates distinct apartment units at same coordinates', () => {
  const reference = {
    name: 'Căn 101 tòa nhà Hòa Lạc',
    phone: '0912345678',
    realEstate: {
      transactionType: 'RENT', propertyType: 'APARTMENT',
      areaM2: 40, monthlyRentVnd: 6000000
    }
  };
  const otherUnit = rankPropertyCandidate({
    id: 22, source: 'PUBLISHED',
    name: 'Căn 102 tòa nhà Hòa Lạc', phone: '0912345678', distanceM: 0,
    listingType: 'RENT', propertyType: 'APARTMENT',
    areaM2: 40, monthlyRent: 6000000
  }, reference);
  assert.equal(otherUnit.differentUnit, true);
  assert.equal(otherUnit.risk, 'REVIEW');
  assert.ok(otherUnit.evidence.includes('DIFFERENT_UNIT'));

  const unrelated = rankPropertyCandidate({
    id: 23, source: 'PENDING',
    name: 'Quán ăn gần trường FPT', phone: '0999999999', distanceM: 0,
    listingType: 'RENT', propertyType: 'OTHER'
  }, reference);
  assert.equal(unrelated.risk, 'NEARBY',
    'zero-meter proximity alone must not signal a duplicate');
});

test('Data Trust V3 carries only bounded staff-only matching details from both sources', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) return { rows: [{
        id: 100, name: 'Nhà phố 3 tầng gần FPT',
        phone: '0987654321', address: 'Hòa Lạc', distance_m: 12,
        listing_type: 'SALE', property_type: 'HOUSE',
        area_m2: '102', total_price_vnd: '3200000000', monthly_rent: null
      }] };
      return { rows: [{
        contribution_id: 101, name: 'Căn 203',
        phone: '0911111111', address: 'Hòa Lạc', distance_m: 0,
        listing_type: 'RENT', property_type: 'APARTMENT',
        area_m2: '35', total_price_vnd: null, monthly_rent: '5000000'
      }] };
    }
  };
  const result = await findNearbyPropertyCandidates({
    contributionId: 90, payload: sample, client
  });
  assert.equal(result.version, 4);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].source, 'PUBLISHED');
  assert.equal(result.items[0].samePropertyType, true);
  assert.equal(result.items[1].source, 'PENDING');
  assert.ok(calls[0].sql.includes('housing_listings'));
  assert.ok(calls[0].sql.includes("hl.listing_status = 'ACTIVE'"));
  assert.ok(calls[1].sql.includes('realEstate,areaM2'));
  assert.deepEqual(calls[1].params, [105.52522, 21.01354, 100, 90, 12]);
});

test('Data Trust V3 batch triage prioritizes genuine risk without exposing private payload or phone', async () => {
  const pending = [
    { id: 601, created_at: '2026-11-23T00:00:00Z', payload: sample },
    {
      id: 602, created_at: '2026-11-23T00:01:00Z',
      payload: { ...sample, place: {
        ...sample.place, name: 'Căn 203 tại ĐHQG', phone: '0911111111',
        realEstate: { transactionType: 'RENT', propertyType: 'APARTMENT' }
      } }
    },
    { id: 603, created_at: '2026-11-23T00:02:00Z', payload: sample }
  ];
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('FROM contributions\n')) {
        assert.deepEqual(params, [3, 0]);
        return { rows: pending };
      }
      if (sql.includes('FROM places p')) {
        return { rows: [{
          id: 991, name: 'Nhà phố 3 tầng gần FPT',
          address: 'Hòa Lạc', phone: '0987654321', distance_m: 12,
          listing_type: 'SALE', property_type: 'HOUSE'
        }] };
      }
      return { rows: [] };
    }
  };

  const triage = await scanPendingPropertyRiskQueue({
    client, limit: 2, offset: 0
  });
  assert.equal(triage.version, 4);
  assert.equal(triage.mode, 'READ_ONLY');
  assert.equal(triage.scannedCount, 2);
  assert.equal(triage.hasMore, true);
  assert.deepEqual(triage.items.map(x => x.contributionId), [601, 602]);
  assert.equal(triage.items[0].priority, 'HIGH');
  assert.equal(triage.items[1].priority, 'LOW');
  assert.equal(triage.needsAttention, 1);
  assert.equal(queries.length, 5);
  const response = JSON.stringify(triage);
  for (const key of ['payload', 'phone', 'lat', 'lng', 'email',
    'sessionId', 'contactName', 'totalPriceVnd']) {
    assert.equal(response.includes('"' + key + '"'), false);
  }
  assert.equal(response.includes('0987654321'), false);
  assert.equal(response.includes('0911111111'), false);
});

test('Data Trust V3 triage has strict bounded limits and no database writes', async () => {
  let calls = 0;
  const client = {
    async query(sql, params) {
      calls++;
      assert.match(sql, /^SELECT /);
      assert.deepEqual(params, [11, 20]);
      return { rows: [] };
    }
  };
  for (const value of [
    { limit: 0, offset: 0 },
    { limit: 11, offset: 0 },
    { limit: -1, offset: 0 },
    { limit: 10, offset: 501 },
    { limit: 2.5, offset: 0 },
    { limit: 1, offset: -10 }
  ]) {
    await assert.rejects(() => scanPendingPropertyRiskQueue({ ...value, client }),
      error => error.statusCode === 400);
  }
  assert.equal(calls, 0);
  const result = await scanPendingPropertyRiskQueue({ client, limit: 10, offset: 20 });
  assert.equal(result.items.length, 0);
  assert.equal(result.needsAttention, 0);
  assert.equal(calls, 1);
});
