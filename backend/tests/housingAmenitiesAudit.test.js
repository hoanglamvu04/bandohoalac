import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/database/pool.js';
import { getHousingNearbyAmenities } from '../src/services/housingInsights.service.js';
import { auditHousingAmenities } from '../src/scripts/auditHousingAmenities.js';

test('PostGIS measures amenities by service zone and counts only public, eligible evidence', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires isolated PG16 test database');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TEMP TABLE categories (id int PRIMARY KEY, slug text, name text) ON COMMIT DROP;
      CREATE TEMP TABLE places (
        id bigint PRIMARY KEY, name text, category_id int, status text,
        location geometry(Point, 4326), last_verified_at timestamptz
      ) ON COMMIT DROP;
      CREATE TEMP TABLE housing_listings (
        place_id bigint PRIMARY KEY, listing_status text, expires_at timestamptz
      ) ON COMMIT DROP;

      INSERT INTO categories VALUES
        (1, 'bat-dong-san', 'Bất động sản'), (2, 'truong-hoc', 'Trường học'),
        (3, 'y-te', 'Y tế'), (4, 'cafe', 'Cafe'), (5, 'co-quan', 'Cơ quan');
      INSERT INTO places
      SELECT v.id, 'Fixture ' || v.id, v.category_id, v.status,
             ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326),
             NOW() + v.verified_days * INTERVAL '1 day'
      FROM (VALUES
        (1, 1, 'PUBLISHED', 105.515, 21.015, NULL),
        (2, 1, 'PUBLISHED', 105.405, 21.090, NULL),
        (3, 1, 'PUBLISHED', 105.515, 21.015, NULL),
        (4, 1, 'PENDING',   105.515, 21.015, NULL),
        (5, 1, 'PUBLISHED', 105.900, 21.015, NULL),
        (11, 2, 'PUBLISHED', 105.516, 21.015, -180),
        (12, 2, 'PUBLISHED', 105.517, 21.015, -181),
        (13, 3, 'PENDING',   105.516, 21.015, -1),
        (14, 3, 'PUBLISHED', 105.530, 21.015, -1),
        (15, 4, 'PUBLISHED', 105.516, 21.015, NULL),
        (16, 5, 'PUBLISHED', 105.516, 21.015, -1),
        (17, 4, 'PUBLISHED', 105.517, 21.015, 1)
      ) AS v(id, category_id, status, lng, lat, verified_days);
      INSERT INTO housing_listings VALUES
        (1, 'ACTIVE', NULL), (2, 'ACTIVE', NULL),
        (3, 'ACTIVE', NOW()), (4, 'ACTIVE', NULL), (5, 'ACTIVE', NULL);
    `);

    const report = await auditHousingAmenities(client);
    const find = (zone, category) => report.rows.find((row) =>
      row.zoneId === zone && row.categorySlug === category);
    assert.equal(report.radiusM, 1000);
    assert.equal(report.freshnessDays, 180);
    assert.equal(report.rows.length, 10 * 8);
    assert.deepEqual(find('hoa-lac', 'truong-hoc'), {
      zoneId: 'hoa-lac', zoneName: 'Hòa Lạc', categorySlug: 'truong-hoc',
      activeListings: 1, listingsWithPoi: 1, listingsWithRecentlyVerifiedPoi: 1
    });
    assert.equal(find('hoa-lac', 'y-te').listingsWithPoi, 0);
    assert.equal(find('hoa-lac', 'cafe').listingsWithPoi, 1);
    assert.equal(find('hoa-lac', 'cafe').listingsWithRecentlyVerifiedPoi, 0);
    assert.equal(find('yen-bai', 'truong-hoc').activeListings, 1);
    assert.equal(find('yen-bai', 'truong-hoc').listingsWithPoi, 0);
    assert.equal(find('ha-bang', 'truong-hoc').activeListings, 0);
    assert.equal(find('outside-service-zones', 'truong-hoc').activeListings, 1);
    assert.doesNotMatch(JSON.stringify(report), /Fixture/);

    const result = await getHousingNearbyAmenities('1', '1000', client);
    assert.equal(result.matchedCount, 4);
    assert.deepEqual(result.dataQuality.verification, { recent: 1, older: 1, unknown: 2 });
    assert.equal((await getHousingNearbyAmenities('2', '1000', client)).matchedCount, 0);
    await assert.rejects(getHousingNearbyAmenities('3', '1000', client), { statusCode: 404 });
    await assert.rejects(getHousingNearbyAmenities('4', '1000', client), { statusCode: 404 });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
