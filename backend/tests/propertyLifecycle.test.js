import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/database/pool.js';
import { createContributionSchema } from '../src/validators/contribution.validators.js';
import { housingManageActionSchema } from '../src/validators/housing.validators.js';
import { managePropertyListing } from '../src/services/housingLifecycle.service.js';
import { getHousingListingByPlaceId } from '../src/services/housing.service.js';

test('lifecycle actions accept only allowed explicit transitions', () => {
  for (const action of ['CONFIRM_ACTIVE', 'PAUSE', 'SOLD', 'RENTED']) {
    assert.equal(housingManageActionSchema.safeParse({ action }).success, true);
  }
  for (const action of ['REACTIVATE', 'DELETE', 'PUBLISH']) {
    assert.equal(housingManageActionSchema.safeParse({ action }).success, false);
  }
});

test('property price edits must go through UPDATE_PRICE moderation', () => {
  const request = {
    type: 'UPDATE_PRICE',
    placeId: 42,
    place: { realEstatePriceVnd: 2500000000 }
  };
  assert.equal(createContributionSchema.safeParse(request).success, true);
  assert.equal(createContributionSchema.safeParse({
    ...request, type: 'UPDATE_PLACE'
  }).success, false);
  assert.equal(createContributionSchema.safeParse({
    ...request, place: { realEstatePriceVnd: -10 }
  }).success, false);
});

test('property owner can confirm and close; stranger cannot; closed property is private', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires isolated test database');
    return;
  }
  const token = randomUUID().replace(/-/g, '');
  let userId = null;
  let placeId = null;
  try {
    const user = await pool.query(
      \`INSERT INTO users(name,email,password_hash,role)
       VALUES($1,$2,'test-only-not-a-real-hash','USER') RETURNING id\`,
      ['Lifecycle QA', 'lifecycle-' + token + '@example.invalid']
    );
    userId = user.rows[0].id;

    const place = await pool.query(
      \`INSERT INTO places(name,slug,description,category_id,address,location,
                          phone,status,source,created_by)
       VALUES($1,$2,'QA-only fixture',
         (SELECT id FROM categories WHERE slug='bat-dong-san'),
         'Test area, Hòa Lạc',
         ST_SetSRID(ST_MakePoint(105.52522,21.01354),4326),
         '0987654321','PUBLISHED','USER',$3) RETURNING id\`,
      ['P0 lifecycle fixture', 'p0-lifecycle-' + token, userId]
    );
    placeId = place.rows[0].id;
    await pool.query(
      \`INSERT INTO housing_listings(
        place_id,listing_type,property_type,total_price_vnd,area_m2,
        listing_status,expires_at
      ) VALUES($1,'SALE','HOUSE',3000000000,80,'ACTIVE',NOW() + INTERVAL '30 days')\`,
      [placeId]
    );

    await assert.rejects(
      managePropertyListing(placeId, { id: Number(userId) + 99999, role: 'USER' }, 'SOLD'),
      (err) => err.statusCode === 403 || err.status === 403
    );

    const renewal = await managePropertyListing(placeId, { id: userId, role: 'USER' }, 'CONFIRM_ACTIVE');
    assert.equal(renewal.listingStatus, 'ACTIVE');

    const close = await managePropertyListing(placeId, { id: userId, role: 'USER' }, 'SOLD');
    assert.equal(close.listingStatus, 'SOLD');

    const data = await pool.query(
      \`SELECT p.status, hl.listing_status
       FROM places p JOIN housing_listings hl ON hl.place_id=p.id WHERE p.id=$1\`,
      [placeId]
    );
    assert.equal(data.rows[0].status, 'ARCHIVED');
    assert.equal(data.rows[0].listing_status, 'SOLD');
    assert.equal(await getHousingListingByPlaceId(placeId), null);
  } finally {
    if (placeId) await pool.query('DELETE FROM places WHERE id=$1', [placeId]);
    if (userId) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});
