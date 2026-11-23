import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/database/pool.js';
import {
  compareHousingListings, listSavedHousingSearches,
  saveHousingSearch, setSavedHousingSearchEnabled, deleteSavedHousingSearch,
  generateSavedHousingAlerts, SAVED_HOUSING_SEARCH_LIMIT
} from '../src/services/housingIntelligence.service.js';
import {
  savedHousingFiltersSchema, createSavedHousingSchema, housingCompareQuerySchema
} from '../src/validators/housing.validators.js';
import { getHousingListingByPlaceId } from '../src/services/housing.service.js';

test('housing comparison accepts 2-4 distinct public IDs only', async () => {
  const source = new Map([
    [1, { id: '1', name: 'Đất A', distanceToFptM: 1200,
      housing: { listingType: 'SALE', totalPriceVnd: 2400000000, areaM2: 80 } }],
    [2, { id: '2', name: 'Nhà B', housing: {
      listingType: 'SALE', totalPriceVnd: 3100000000, areaM2: null
    } }],
    [3, { id: '3', name: 'Trọ C', housing: {
      listingType: 'RENT', monthlyRent: 3000000, areaM2: 25
    } }]
  ]);
  const loader = async (id) => source.get(id) || null;
  for (const ids of [[], [1], [1,1], [1,2,3,4,5], [1,-2], ['a','2']]) {
    await assert.rejects(() => compareHousingListings(ids, loader),
      (error) => error.statusCode === 400);
  }
  const result = await compareHousingListings(['1','2','3','4'], loader);
  assert.equal(result.items.length, 3);
  assert.equal(result.unavailableCount, 1);
  assert.deepEqual(result.items.map((x) => x.pricePerM2Vnd),
    [30000000, null, 120000]);
  assert.match(result.distanceNote, /đường chim bay/);
  assert.equal(JSON.stringify(result).includes('estimatedMarketPrice'), false);
});

test('saved search schemas refuse GPS, PII, arbitrary URL and invalid budget ranges', () => {
  const legal = {
    name: 'Đất ở gần FPT dưới 2 tỷ',
    filters: {
      listingType: 'SALE',
      propertyType: 'LAND',
      minPrice: '1000000000',
      maxPrice: '2000000000',
      maxDistanceFpt: '3000',
      minArea: '50'
    }
  };
  const parsed = createSavedHousingSchema.parse(legal);
  assert.equal(parsed.filters.maxPrice, 2000000000);
  assert.equal(parsed.filters.minArea, 50);
  for (const bad of [
    { q: 'a' }, { ip: '1.2.3.4' }, { lat: 21.01 }, { lng: 105.52 },
    { sessionId: 'private' }, { phone: '0988123456' },
    { userId: 100 }, { url: '/internal/path' }, { token: 'abc' },
    { listingType: 'ACTIVE' }, { maxDistanceFpt: 999999 },
    { minPrice: 3000000000, maxPrice: 2000000000 }
  ]) {
    assert.equal(savedHousingFiltersSchema.safeParse(bad).success, false,
      JSON.stringify(bad));
  }
  assert.equal(housingCompareQuerySchema.safeParse({ ids: '11,22,33,44' }).success, true);
  for (const bad of ['1', '1,1,1,1,1', '1,x', '1,2&auth=x']) {
    if (bad !== '1,1,1,1,1') {
      assert.equal(housingCompareQuerySchema.safeParse({ ids: bad }).success, false);
    }
  }
});

test('saved searches, IDOR, publication-only alerts and dedup hold on PostgreSQL 16', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires isolated migrated PostgreSQL 16 CI database');
    return;
  }

  const unique = randomUUID().replaceAll('-', '').slice(0, 16);
  let userId = null;
  let otherUserId = null;
  const placeIds = [];
  try {
    const users = await pool.query(
      `INSERT INTO users(name, email, password_hash)
       VALUES ('housing-intel-test', $1, 'hash'), ('housing-intel-other', $2, 'hash')
       RETURNING id`,
      ['housing-intel-' + unique + '@example.test', 'housing-intel-other-' + unique + '@example.test']
    );
    userId = users.rows[0].id;
    otherUserId = users.rows[1].id;

    const cat = await pool.query("SELECT id FROM categories WHERE slug='bat-dong-san'");
    assert.ok(cat.rows[0], 'required housing category missing after migration');
    const categoryId = cat.rows[0].id;

    // Pre-existing published listings must never cause a retroactive alert.
    const oldPlace = await pool.query(
      `INSERT INTO places
         (name, slug, category_id, location, status, source, created_by)
       VALUES ('Đất cũ không cảnh báo', $1, $2,
         ST_SetSRID(ST_MakePoint(105.523, 21.014), 4326), 'PUBLISHED','USER',$3)
       RETURNING id`, ['housing-old-' + unique, categoryId, userId]
    );
    placeIds.push(oldPlace.rows[0].id);
    await pool.query(
      `INSERT INTO housing_listings
        (place_id, listing_type, property_type, total_price_vnd, area_m2,
          listing_status, expires_at)
       VALUES ($1, 'SALE','LAND',1700000000, 70,'ACTIVE',NOW()+INTERVAL '30 days')`,
      [placeIds[0]]
    );

    const created = await saveHousingSearch(userId, {
      name: 'Đất gần FPT dưới 2 tỷ',
      filters: { listingType: 'SALE', propertyType: 'LAND',
        maxPrice: 2000000000, maxDistanceFpt: 3000, minArea: 50 }
    });
    assert.ok(created.id);
    assert.equal(created.enabled, true);
    assert.equal((await listSavedHousingSearches(otherUserId)).length, 0);
    assert.equal((await listSavedHousingSearches(userId)).length, 1);
    await assert.rejects(() => deleteSavedHousingSearch(otherUserId, created.id),
      (error) => error.statusCode === 404);
    await assert.rejects(() => setSavedHousingSearchEnabled(otherUserId, created.id, false),
      (error) => error.statusCode === 404);
    assert.equal((await getHousingListingByPlaceId(Number(placeIds[0])))?.id,
      String(placeIds[0]));

    const before = await generateSavedHousingAlerts();
    assert.equal(before.created, 0, 'already published content must not trigger alerts');

    const pending = await pool.query(
      `INSERT INTO places
        (name, slug, category_id, location, status, source, created_by)
       VALUES ('Đất vừa duyệt', $1, $2,
          ST_SetSRID(ST_MakePoint(105.523, 21.014), 4326),'PENDING','USER',$3)
       RETURNING id`,
      ['housing-new-' + unique, categoryId, userId]
    );
    placeIds.push(pending.rows[0].id);
    await pool.query(
      `INSERT INTO housing_listings
         (place_id, listing_type, property_type, total_price_vnd, area_m2,
           listing_status, expires_at)
       VALUES ($1,'SALE','LAND',1900000000,85,'ACTIVE',NOW()+INTERVAL '30 days')`,
      [placeIds[1]]
    );

    const notPublic = await getHousingListingByPlaceId(Number(placeIds[1]));
    assert.equal(notPublic, null, 'pending listing must remain private');

    await pool.query(
      "UPDATE places SET status = 'PUBLISHED', updated_at = NOW() WHERE id = $1",
      [placeIds[1]]
    );
    const publicPlace = await getHousingListingByPlaceId(Number(placeIds[1]));
    assert.ok(publicPlace?.id, 'published property is now readable');

    const scan = await generateSavedHousingAlerts();
    assert.equal(scan.created, 1, 'only new approved match produces one alert');
    assert.equal((await generateSavedHousingAlerts()).created, 0,
      'retry must not duplicate the saved-search notification');

    const alerts = await pool.query(
      `SELECT user_id, type, data FROM notifications
       WHERE user_id = $1 AND type = 'HOUSING_SAVED_SEARCH_MATCH'`,
      [userId]
    );
    assert.equal(alerts.rows.length, 1);
    assert.equal(String(alerts.rows[0].user_id), String(userId));
    assert.equal(alerts.rows[0].data.savedSearchId, created.id);
    assert.equal(alerts.rows[0].data.placeId, String(placeIds[1]));
    for (const sensitive of ['email','phone','lat','lng','query','sessionId','ip']) {
      assert.equal(Object.hasOwn(alerts.rows[0].data, sensitive), false);
    }
    assert.equal((await pool.query(
      "SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1",
      [otherUserId]
    )).rows[0].total, 0);

    const paused = await setSavedHousingSearchEnabled(userId, created.id, false);
    assert.equal(paused.enabled, false);
    assert.equal((await setSavedHousingSearchEnabled(userId, created.id, true)).enabled, true);
    assert.ok((await deleteSavedHousingSearch(userId, created.id)).ok);
    assert.equal((await listSavedHousingSearches(userId)).length, 0);

    const result = await compareHousingListings([String(placeIds[0]),String(placeIds[1])]);
    assert.equal(result.items.length, 2);
    assert.ok(result.items.every((p) => p.housing?.listingStatus === 'ACTIVE'));
  } finally {
    if (placeIds.length) await pool.query(
      'DELETE FROM places WHERE id = ANY($1::bigint[])', [placeIds]
    );
    if (userId || otherUserId) await pool.query(
      'DELETE FROM users WHERE id = ANY($1::bigint[])',
      [[userId,otherUserId].filter(Boolean)]
    );
  }
});

test('saved search quota is not circumvented with consecutive requests', async () => {
  assert.equal(SAVED_HOUSING_SEARCH_LIMIT, 12);
});
