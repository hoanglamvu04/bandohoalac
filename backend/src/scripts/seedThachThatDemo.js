import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { pool } from '../database/pool.js';
import {
  DEMO_SOURCE, DEMO_IMAGE_PROVIDER, DEMO_SEED_CONFIRM, DEMO_CLEAN_CONFIRM,
  THACH_THAT_DEMO_LISTINGS, THACH_THAT_DEMO_SUMMARY
} from '../database/thachThatDemoData.js';

const STAGING_DB_NAME = /(?:^|[_-])(?:demo|staging|stage|test|testing|ci|dev)(?:$|[_-])/i;

export function assertDemoSeedTarget({ nodeEnv, databaseUrl, confirmation, action }) {
  // The separate DB-name pattern is an additional guard, not proof of physical
  // isolation. An operator must verify the staging DB/host independently.
  if (nodeEnv === 'production') throw new Error('DEMO_SEED_REFUSES_PRODUCTION');
  if (!['apply', 'clean'].includes(action)) throw new Error('INVALID_DEMO_ACTION');
  if (confirmation !== (action === 'apply' ? DEMO_SEED_CONFIRM : DEMO_CLEAN_CONFIRM)) {
    throw new Error('DEMO_SEED_CONFIRMATION_MISSING');
  }

  let url;
  try { url = new URL(databaseUrl); } catch { throw new Error('INVALID_DEMO_DATABASE_URL'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error('INVALID_DEMO_DATABASE_URL');
  }
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!dbName || !STAGING_DB_NAME.test(dbName)) {
    throw new Error('DEMO_SEED_REQUIRES_SEPARATE_TEST_OR_STAGING_DATABASE');
  }
  // Never log username, password, hostname or connection string.
  return { databaseName: dbName };
}

export async function verifyDemoDatabaseTarget(client, expectedDbName) {
  const { rows } = await client.query('SELECT current_database() AS name');
  if (rows?.length !== 1 || rows[0].name !== expectedDbName ||
      !STAGING_DB_NAME.test(rows[0].name)) {
    throw new Error('DEMO_SEED_DATABASE_IDENTITY_MISMATCH');
  }
}

const INSERT_PLACE = [
  'INSERT INTO places (',
  ' name, slug, description, category_id, address, location,',
  ' phone, price_level, status, source, external_source, external_id',
  ') VALUES (',
  ' $1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6::double precision,$7::double precision),4326),',
  " $8,$9,'PUBLISHED','ADMIN',$10,$11",
  ') ON CONFLICT (external_source,external_id)',
  ' WHERE external_source IS NOT NULL AND external_id IS NOT NULL',
  ' DO UPDATE SET',
  ' name=EXCLUDED.name, description=EXCLUDED.description,',
  ' category_id=EXCLUDED.category_id, address=EXCLUDED.address,',
  ' location=EXCLUDED.location, phone=EXCLUDED.phone,',
  " price_level=EXCLUDED.price_level, status='PUBLISHED'",
  " WHERE places.slug=EXCLUDED.slug AND places.source='ADMIN'",
  ' RETURNING id'
].join(' ');

async function upsertDemoPlace(client, row, categoryId) {
  const { rows } = await client.query(INSERT_PLACE, [
    row.name, row.slug, row.description, categoryId, row.address,
    row.lng, row.lat, row.phone, row.priceLevel, DEMO_SOURCE, row.externalId
  ]);
  if (rows.length !== 1) throw new Error('DEMO_PLACE_CONFLICT_OR_NON_DEMO_OWNER');
  return rows[0].id;
}

const INSERT_HOUSING = [
  'INSERT INTO housing_listings (',
  ' place_id, listing_type, property_type, total_price_vnd,',
  ' monthly_rent, deposit_amount, area_m2, availability_status,',
  ' available_rooms, total_rooms, electricity_price_per_kwh,',
  ' water_price_per_person_month, parking_fee_monthly,',
  ' has_air_conditioner, has_water_heater, has_private_bathroom,',
  ' has_loft, has_balcony, has_parking, allows_pets,',
  ' availability_note, contact_name, listing_status, expires_at,',
  ' verification_source, last_verified_at',
  ') VALUES (',
  ' $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,',
  " $14,$15,$16,$17,$18,$19,$20,$21,$22,'ACTIVE',",
  " NOW() + INTERVAL '120 days','COMMUNITY',NULL",
  ') ON CONFLICT (place_id) DO UPDATE SET',
  ' listing_type=EXCLUDED.listing_type, property_type=EXCLUDED.property_type,',
  ' total_price_vnd=EXCLUDED.total_price_vnd, monthly_rent=EXCLUDED.monthly_rent,',
  ' deposit_amount=EXCLUDED.deposit_amount, area_m2=EXCLUDED.area_m2,',
  ' availability_status=EXCLUDED.availability_status,',
  ' available_rooms=EXCLUDED.available_rooms, total_rooms=EXCLUDED.total_rooms,',
  ' electricity_price_per_kwh=EXCLUDED.electricity_price_per_kwh,',
  ' water_price_per_person_month=EXCLUDED.water_price_per_person_month,',
  ' parking_fee_monthly=EXCLUDED.parking_fee_monthly,',
  ' has_air_conditioner=EXCLUDED.has_air_conditioner,',
  ' has_water_heater=EXCLUDED.has_water_heater,',
  ' has_private_bathroom=EXCLUDED.has_private_bathroom,',
  ' has_loft=EXCLUDED.has_loft, has_balcony=EXCLUDED.has_balcony,',
  ' has_parking=EXCLUDED.has_parking, allows_pets=EXCLUDED.allows_pets,',
  ' availability_note=EXCLUDED.availability_note, contact_name=EXCLUDED.contact_name,',
  " listing_status='ACTIVE', expires_at=EXCLUDED.expires_at,",
  " verification_source='COMMUNITY', last_verified_at=NULL"
].join(' ');

async function upsertDemoHousing(client, placeId, row) {
  await client.query(INSERT_HOUSING, [
    placeId, row.listingType, row.propertyType, row.totalPriceVnd,
    row.monthlyRent, row.depositAmount, row.areaM2, row.availabilityStatus,
    row.availableRooms, row.totalRooms, row.electricityPricePerKwh,
    row.waterPricePerPersonMonth, row.parkingFeeMonthly,
    row.hasAirConditioner, row.hasWaterHeater, row.hasPrivateBathroom,
    row.hasLoft, row.hasBalcony, row.hasParking, row.allowsPets,
    'Dữ liệu DEMO, không thể dùng để giao dịch hoặc xác minh nguồn thực tế.',
    'HOLA DEMO - không liên hệ'
  ]);
}

async function replaceDemoImages(client, placeId, row) {
  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS other_images FROM place_images ' +
      'WHERE place_id=$1 AND storage_provider IS DISTINCT FROM $2',
    [placeId, DEMO_IMAGE_PROVIDER]
  );
  if (rows[0]?.other_images !== 0) throw new Error('DEMO_PLACE_HAS_NON_DEMO_IMAGES');
  await client.query(
    'DELETE FROM place_images WHERE place_id=$1 AND storage_provider=$2',
    [placeId, DEMO_IMAGE_PROVIDER]
  );
  for (let index = 0; index < row.images.length; index++) {
    const image = row.images[index];
    await client.query(
      'INSERT INTO place_images (' +
        'place_id,url,is_cover,storage_provider,storage_public_id,' +
        'storage_asset_folder,thumbnail_url,card_url' +
      ') VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        placeId, image.imageUrl, index === 0,
        DEMO_IMAGE_PROVIDER, image.photoId, DEMO_SOURCE,
        image.thumbnailUrl, image.cardUrl
      ]
    );
  }
}

export async function seedThachThatDemo(client) {
  const { rows } = await client.query(
    "SELECT id FROM categories WHERE slug='bat-dong-san' LIMIT 1"
  );
  if (rows.length !== 1) throw new Error('DEMO_REQUIRES_REAL_ESTATE_CATEGORY');
  const categoryId = rows[0].id;
  for (const record of THACH_THAT_DEMO_LISTINGS) {
    const placeId = await upsertDemoPlace(client, record, categoryId);
    await upsertDemoHousing(client, placeId, record);
    await replaceDemoImages(client, placeId, record);
  }
  return THACH_THAT_DEMO_SUMMARY;
}

export async function cleanThachThatDemo(client) {
  let deleted = 0;
  // Exact source AND external ID AND slug; never delete unrelated records.
  for (const record of THACH_THAT_DEMO_LISTINGS) {
    const { rowCount } = await client.query(
      "DELETE FROM places WHERE external_source=$1 AND external_id=$2 " +
      "AND slug=$3 AND source='ADMIN'",
      [DEMO_SOURCE, record.externalId, record.slug]
    );
    deleted += rowCount;
  }
  return { deleted };
}

async function main() {
  const flags = ['--apply', '--clean', '--preview'].filter((f) => process.argv.includes(f));
  if (flags.length !== 1) {
    throw new Error('Use exactly one of --preview, --apply or --clean.');
  }
  const action = flags[0].slice(2);
  if (action === 'preview') {
    console.log(JSON.stringify({
      mode: 'PREVIEW_ONLY_NO_DATABASE_CONNECTION',
      ...THACH_THAT_DEMO_SUMMARY,
      slugs: THACH_THAT_DEMO_LISTINGS.map(({ slug }) => slug)
    }, null, 2));
    return;
  }

  const target = assertDemoSeedTarget({
    nodeEnv: env.nodeEnv,
    databaseUrl: env.databaseUrl,
    confirmation: process.env.HOLA_DEMO_SEED_CONFIRM,
    action
  });

  const client = await pool.connect();
  let inTransaction = false;
  try {
    await verifyDemoDatabaseTarget(client, target.databaseName);
    await client.query('BEGIN');
    inTransaction = true;
    await client.query("SET LOCAL statement_timeout = '20s'");
    const result = action === 'apply'
      ? await seedThachThatDemo(client) : await cleanThachThatDemo(client);
    await client.query('COMMIT');
    inTransaction = false;
    console.log(JSON.stringify({
      mode: action === 'apply' ? 'STAGING_DEMO_SEEDED' : 'STAGING_DEMO_REMOVED',
      ...result, production: false
    }, null, 2));
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    // Do not print connection strings, SQL parameters, or credentials.
    const safeCodes = [
      'DEMO_SEED_REFUSES_PRODUCTION', 'INVALID_DEMO_ACTION',
      'DEMO_SEED_CONFIRMATION_MISSING', 'INVALID_DEMO_DATABASE_URL',
      'DEMO_SEED_REQUIRES_SEPARATE_TEST_OR_STAGING_DATABASE',
      'DEMO_SEED_DATABASE_IDENTITY_MISMATCH',
      'DEMO_PLACE_CONFLICT_OR_NON_DEMO_OWNER',
      'DEMO_PLACE_HAS_NON_DEMO_IMAGES', 'DEMO_REQUIRES_REAL_ESTATE_CATEGORY'
    ];
    console.error('[thach-that-demo]',
      safeCodes.includes(error.message) ? error.message : 'SEED_FAILED_CHECK_SCHEMA_AND_ACCESS');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
