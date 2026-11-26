import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/database/pool.js';
import { isInsideServiceCoverage } from '../src/config/mapCoverage.js';
import {
  DEMO_SOURCE, DEMO_NAMESPACE, DEMO_IMAGE_PROVIDER,
  DEMO_SEED_CONFIRM, DEMO_CLEAN_CONFIRM,
  THACH_THAT_DEMO_LISTINGS, THACH_THAT_DEMO_SUMMARY
} from '../src/database/thachThatDemoData.js';
import {
  assertDemoSeedTarget, verifyDemoDatabaseTarget,
  seedThachThatDemo, cleanThachThatDemo
} from '../src/scripts/seedThachThatDemo.js';

test('30 branded Thạch Thất demo listings contain 15 room rentals and 120 illustrative photos', () => {
  assert.deepEqual(THACH_THAT_DEMO_SUMMARY, {
    total: 30, roomRentals: 15, otherProperties: 15, photoRows: 120
  });
  assert.equal(new Set(THACH_THAT_DEMO_LISTINGS.map((x) => x.slug)).size, 30);
  assert.equal(new Set(THACH_THAT_DEMO_LISTINGS.map((x) => x.externalId)).size, 30);
  assert.equal(new Set(THACH_THAT_DEMO_LISTINGS.map((x) => x.phone)).size, 30);
  const rentRooms = THACH_THAT_DEMO_LISTINGS.filter((x) =>
    x.listingType === 'RENT' && x.propertyType === null);
  assert.equal(rentRooms.length, 15);
  assert.equal(THACH_THAT_DEMO_LISTINGS.filter((x) => x.listingType === 'SALE').length, 10);
  assert.equal(THACH_THAT_DEMO_LISTINGS.filter((x) =>
    x.listingType === 'RENT' && x.propertyType !== null).length, 5);

  for (const listing of THACH_THAT_DEMO_LISTINGS) {
    assert.ok(listing.slug.startsWith(DEMO_NAMESPACE));
    assert.match(listing.name, /^\[DEMO \d{2}\]/);
    assert.match(listing.description, /KHÔNG PHẢI TIN THẬT/);
    assert.match(listing.description, /Ảnh Unsplash chỉ minh họa/);
    assert.match(listing.address, /Thạch Thất cũ, Hà Nội.*minh họa/);
    assert.equal(isInsideServiceCoverage(listing.lng, listing.lat), true, listing.slug);
    assert.ok(listing.areaM2 > 0);
    assert.equal(listing.listingType === 'SALE'
      ? listing.totalPriceVnd > 0 && listing.monthlyRent === null
      : listing.monthlyRent > 0 && listing.totalPriceVnd === null, true);
    assert.ok(listing.phone.startsWith('00000000'));
    assert.equal(listing.images.length, 4);
    assert.equal(new Set(listing.images.map((img) => img.photoId)).size, 4);
    for (const image of listing.images) {
      assert.match(image.imageUrl, /^https:\/\/images\.unsplash\.com\/photo-/);
      assert.match(image.cardUrl, /&w=720&q=75/);
      assert.match(image.thumbnailUrl, /&w=400&q=72/);
    }
  }
  for (const room of rentRooms) {
    assert.equal(room.depositAmount, room.monthlyRent);
    assert.equal(room.hasPrivateBathroom, true);
    assert.equal(room.availabilityStatus, 'AVAILABLE');
    assert.equal(room.availableRooms, 1);
    assert.equal(room.totalRooms, 1);
    assert.ok(room.electricityPricePerKwh > 0);
  }
});

test('seed and cleanup reject production, wrong DB names, missing or wrong confirmations', () => {
  const sample = {
    nodeEnv: 'development',
    databaseUrl: 'postgresql://user:secret@localhost/hola_maps_staging',
    confirmation: DEMO_SEED_CONFIRM, action: 'apply'
  };
  assert.deepEqual(assertDemoSeedTarget(sample), {
    databaseName:'hola_maps_staging', productionTarget:false
  });
  assert.throws(() => assertDemoSeedTarget({ ...sample, nodeEnv:'production' }),
    /DEMO_SEED_LIVE_CONFIRMATION_REQUIRED/);
  assert.throws(() => assertDemoSeedTarget({ ...sample,
    databaseUrl:'postgresql://user:secret@localhost/hola_maps'
  }), /DEMO_SEED_LIVE_CONFIRMATION_REQUIRED/);
  const live = {
    ...sample, nodeEnv:'production',
    databaseUrl:'postgresql://user:secret@localhost/hola_maps',
    productionConfirmation:'ALLOW_30_LABELED_DEMO_LISTINGS_ON_LIVE_SITE'
  };
  assert.deepEqual(assertDemoSeedTarget(live), {
    databaseName:'hola_maps', productionTarget:true
  });
  assert.deepEqual(assertDemoSeedTarget({ ...live, nodeEnv:'development' }), {
    databaseName:'hola_maps', productionTarget:true
  });
  assert.throws(() => assertDemoSeedTarget({ ...live, action:'clean' }),
    /DEMO_SEED_CONFIRMATION_MISSING/);
  assert.deepEqual(assertDemoSeedTarget({
    ...live, action:'clean', confirmation:DEMO_CLEAN_CONFIRM
  }), { databaseName:'hola_maps', productionTarget:true });
  assert.throws(() => assertDemoSeedTarget({ ...sample, confirmation:'' }),
    /CONFIRMATION_MISSING/);
  assert.throws(() => assertDemoSeedTarget({ ...sample, action:'clean' }),
    /CONFIRMATION_MISSING/);
  assert.deepEqual(assertDemoSeedTarget({
    ...sample, action:'clean', confirmation:DEMO_CLEAN_CONFIRM
  }), { databaseName:'hola_maps_staging', productionTarget:false });
  assert.throws(() => assertDemoSeedTarget({ ...sample, databaseUrl:'https://bad/hola_maps_staging' }),
    /INVALID_DEMO_DATABASE_URL/);
  assert.throws(() => assertDemoSeedTarget({ ...sample, databaseUrl:'not a url' }),
    /INVALID_DEMO_DATABASE_URL/);
});

test('DB identity preflight rejects changed database before writing any row', async () => {
  await assert.rejects(verifyDemoDatabaseTarget({
    async query(sql) {
      assert.match(sql, /current_database/);
      return { rows:[{ name:'hola_maps' }] };
    }
  }, 'hola_maps_staging'), /IDENTITY_MISMATCH/);
  await verifyDemoDatabaseTarget({
    async query() { return { rows:[{ name:'hola_maps_staging' }] }; }
  }, 'hola_maps_staging');
  await assert.rejects(verifyDemoDatabaseTarget({
    async query() { return { rows:[{ name:'hola_maps' }] }; }
  }, 'hola_maps'), /IDENTITY_MISMATCH/);
  await verifyDemoDatabaseTarget({
    async query() { return { rows:[{ name:'hola_maps' }] }; }
  }, 'hola_maps', { productionTarget:true });
});

test('PG16/PostGIS demo seed is idempotent, isolated and exactly removable', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires isolated PG16/PostGIS CI database');
    return;
  }
  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    // Sentinel with no demo source must survive cleanup.
    const sentinelSlug = 'unrelated-property-' + randomUUID();
    const sentinel = await db.query(
      "INSERT INTO places (name,slug,category_id,address,location,status,source) " +
      "VALUES ('Unrelated staging fixture',$1," +
      "(SELECT id FROM categories WHERE slug='bat-dong-san')," +
      "'No demo',ST_SetSRID(ST_MakePoint(105.525,21.015),4326)," +
      "'PENDING','ADMIN') RETURNING id",
      [sentinelSlug]
    );
    const unrelatedId = sentinel.rows[0].id;

    const run1 = await seedThachThatDemo(db);
    assert.deepEqual(run1, THACH_THAT_DEMO_SUMMARY);
    const run2 = await seedThachThatDemo(db);
    assert.deepEqual(run2, THACH_THAT_DEMO_SUMMARY);

    const { rows:[counts] } = await db.query(
      "SELECT COUNT(*)::int AS total," +
      " COUNT(*) FILTER (WHERE hl.listing_type='RENT' AND hl.property_type IS NULL)::int AS rooms," +
      " COUNT(*) FILTER (WHERE hl.listing_type='SALE')::int AS sale," +
      " COUNT(*) FILTER (WHERE hl.listing_status='ACTIVE' AND p.status='PUBLISHED')::int AS active," +
      " COUNT(*) FILTER (WHERE p.phone LIKE '00000000%')::int AS fake_phones " +
      "FROM places p JOIN housing_listings hl ON hl.place_id=p.id " +
      "WHERE p.external_source=$1",
      [DEMO_SOURCE]
    );
    assert.deepEqual(counts, { total:30, rooms:15, sale:10, active:30, fake_phones:30 });

    const { rows:[photos] } = await db.query(
      'SELECT COUNT(*)::int AS photos, ' +
      'COUNT(*) FILTER (WHERE pi.is_cover)::int AS covers ' +
      'FROM place_images pi JOIN places p ON p.id=pi.place_id ' +
      'WHERE p.external_source=$1 AND pi.storage_provider=$2',
      [DEMO_SOURCE, DEMO_IMAGE_PROVIDER]
    );
    assert.deepEqual(photos, { photos:120, covers:30 });

    const { rows:[roomPrices] } = await db.query(
      'SELECT MIN(hl.monthly_rent)::int AS minimum, ' +
      'MAX(hl.monthly_rent)::int AS maximum ' +
      'FROM housing_listings hl JOIN places p ON p.id=hl.place_id ' +
      "WHERE p.external_source=$1 AND hl.property_type IS NULL AND hl.listing_type='RENT'",
      [DEMO_SOURCE]
    );
    assert.ok(roomPrices.minimum >= 1000000);
    assert.ok(roomPrices.maximum <= 5000000);

    // Never silently overwrite images added by another user.
    const { rows:[first] } = await db.query(
      'SELECT id FROM places WHERE external_source=$1 ORDER BY external_id LIMIT 1', [DEMO_SOURCE]
    );
    await db.query('SAVEPOINT demo_image_safety');
    await db.query(
      'INSERT INTO place_images(place_id,url,is_cover) VALUES($1,$2,FALSE)',
      [first.id, 'https://example.invalid/non-demo-photo.jpg']
    );
    await assert.rejects(seedThachThatDemo(db), /DEMO_PLACE_HAS_NON_DEMO_IMAGES/);
    await db.query('ROLLBACK TO SAVEPOINT demo_image_safety');

    assert.deepEqual(await cleanThachThatDemo(db), { deleted:30 });
    assert.deepEqual(await cleanThachThatDemo(db), { deleted:0 });
    const remaining = await db.query(
      'SELECT COUNT(*)::int AS total FROM places WHERE external_source=$1',
      [DEMO_SOURCE]
    );
    assert.equal(remaining.rows[0].total, 0);
    const sentinelCount = await db.query('SELECT COUNT(*)::int AS n FROM places WHERE id=$1', [unrelatedId]);
    assert.equal(sentinelCount.rows[0].n, 1);
  } finally {
    try { await db.query('ROLLBACK'); } finally { db.release(); }
  }
});
