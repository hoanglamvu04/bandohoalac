import test from 'node:test';
import assert from 'node:assert/strict';
import { getDataQualityOverview, scorePlace } from '../src/services/dataQuality.service.js';
import { pool } from '../src/database/pool.js';

function place(overrides = {}) {
  return {
    id: 100,
    name: 'Địa điểm thử nghiệm',
    address: 'Hòa Lạc, Hà Nội',
    description: 'Địa điểm có mô tả',
    category_id: 1,
    category_name: 'Quán cà phê',
    category_slug: 'cafe',
    status: 'PUBLISHED',
    phone: '0987654321',
    website: null,
    opening_hours: null,
    image_count: 2,
    latest_image_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    lat: 21.01354,
    lng: 105.52522,
    duplicate_count: 1,
    ...overrides
  };
}

test('business POIs still require opening hours', () => {
  const result = scorePlace(place());
  assert.equal(result.issues.includes('MISSING_HOURS'), true);
});

test('real-estate listings are not penalized for business opening hours', () => {
  const result = scorePlace(place({
    category_slug: 'bat-dong-san',
    category_name: 'Bất động sản',
    housing_listing_type: 'SALE',
    housing_property_type: 'HOUSE',
    housing_listing_status: 'ACTIVE',
    housing_total_price_vnd: '3500000000',
    housing_area_m2: '80',
    housing_expires_at: new Date(Date.now() + 7 * 86400000).toISOString()
  }));
  assert.equal(result.issues.includes('MISSING_HOURS'), false);
  assert.equal(result.issues.includes('INCOMPLETE_PROPERTY_PROFILE'), false);
  assert.equal(result.issues.includes('MISSING_PROPERTY_PRICE'), false);
  assert.equal(result.issues.includes('MISSING_PROPERTY_AREA'), false);
  assert.equal(result.issues.includes('PROPERTY_EXPIRED'), false);
  assert.equal(result.qualityScore, 100);
});

test('old property missing structured profile is flagged, not treated as a café', () => {
  const result = scorePlace(place({
    category_slug: 'bat-dong-san',
    category_name: 'Bất động sản',
    phone: null,
    website: 'https://example.invalid',
    housing_listing_type: null,
    housing_property_type: null
  }));
  assert.equal(result.issues.includes('INCOMPLETE_PROPERTY_PROFILE'), true);
  assert.equal(result.issues.includes('MISSING_CONTACT'), true);
  assert.equal(result.issues.includes('MISSING_HOURS'), false);
});

test('published stale properties are highlighted for Admin cleanup', () => {
  const result = scorePlace(place({
    category_slug: 'bat-dong-san',
    housing_listing_type: 'RENT',
    housing_property_type: 'APARTMENT',
    housing_listing_status: 'PAUSED',
    housing_monthly_rent: null,
    housing_area_m2: null,
    housing_expires_at: new Date(Date.now() - 2 * 86400000).toISOString()
  }));
  for (const issue of ['PROPERTY_NOT_ACTIVE', 'PROPERTY_EXPIRED', 'MISSING_PROPERTY_PRICE', 'MISSING_PROPERTY_AREA']) {
    assert.equal(result.issues.includes(issue), true, issue);
  }
});

test('null PostGIS coordinates are missing coordinates, not out of coverage at (0,0)', () => {
  const result = scorePlace(place({ lat: null, lng: null }));
  assert.equal(result.issues.includes('MISSING_COORDINATES'), true);
  assert.equal(result.issues.includes('OUT_OF_COVERAGE'), false);
  assert.equal(result.lat, null);
  assert.equal(result.lng, null);
});

test('quality overview reports real published count and audited sample size', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires an isolated PostgreSQL test database');
    return;
  }
  const [overview, count] = await Promise.all([
    getDataQualityOverview({ limit: 10 }),
    pool.query("SELECT COUNT(*)::int AS total FROM places WHERE status = 'PUBLISHED'")
  ]);
  assert.equal(overview.summary.totalPublished, Number(count.rows[0]?.total || 0));
  assert.equal(overview.summary.auditedCount <= overview.summary.totalPublished, true);
  assert.equal(
    overview.summary.auditPartial,
    overview.summary.totalPublished > overview.summary.auditedCount
  );
});
