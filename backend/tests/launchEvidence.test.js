import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicLaunchAudit, publicLaunchAuditExitCode } from '../src/scripts/publicLaunchAudit.js';
import { pool } from '../src/database/pool.js';

const detailCounts = {
  missing_address: 0, missing_description: 0, missing_contact: 0,
  stale_verification: 0, published_properties: 0,
  property_missing_description: 0, property_missing_images: 0
};
import {
  queryPublicLaunchEvidence, createLaunchEvidenceCache,
  LAUNCH_MANUAL_GATES
} from '../src/services/launchEvidence.service.js';

test('launch evidence returns only aggregate public-state counts and never declares readiness', async () => {
  let callCount = 0;
  const db = { async query(sql) {
    callCount++;
    assert.match(sql,/p.status='PUBLISHED'/);
    assert.match(sql,/hl.expires_at/);
    assert.match(sql,/NOT EXISTS/);
    assert.doesNotMatch(sql,/SELECT p\.phone|SELECT p\.name|SELECT p\.id/);
    return { rows: [{
      ...detailCounts, published_properties:35, published_places:200, active_housing:30,
      legacy_unstructured_housing:3, stale_published_housing:2,
      missing_housing_contact:1, invalid_housing_price_area:0,
      published_without_images:16
    }] };
  }};
  const data = await queryPublicLaunchEvidence(db);
  assert.equal(callCount,1);
  assert.equal(data.launchStatus,'NOT_VERIFIED');
  assert.equal(data.dataGate,'NEEDS_REVIEW');
  assert.equal(data.counts.stalePublishedHousing,2);
  assert.ok(data.blockers.includes('STALE_PUBLISHED_HOUSING'));
  assert.equal(data.manualGates.length,LAUNCH_MANUAL_GATES.length);
  assert.ok(data.manualGates.every((item)=>item.status==='UNVERIFIED'));
  const json=JSON.stringify(data);
  for(const privateKey of ['email','phone','lat','lng','token','userId','sessionId']) {
    assert.equal(json.includes('"' + privateKey + '"'),false);
  }
});

test('cached launch evidence is singleflight and refreshes only after the TTL', async () => {
  let clock=1000,calls=0;
  const cached = createLaunchEvidenceCache({
    now:()=>clock, ttlMs:60000,
    load:async()=>{calls++;return { batch:calls }; }
  });
  const [a,b,c]=await Promise.all([cached(),cached(),cached()]);
  assert.deepEqual([a.batch,b.batch,c.batch],[1,1,1]);
  assert.equal(calls,1);
  assert.equal((await cached()).batch,1);
  clock+=61000;
  assert.equal((await cached()).batch,2);
  assert.equal(calls,2);
});

test('clean launch data still cannot prove the VPS is ready to launch', async () => {
  const data=await queryPublicLaunchEvidence({
    async query(){return {rows:[{
      ...detailCounts, published_properties:10, published_places:30,active_housing:10,legacy_unstructured_housing:0,
      stale_published_housing:0,missing_housing_contact:0,
      invalid_housing_price_area:0,published_without_images:0
    }]};}
  });
  assert.equal(data.dataGate,'NO_BLOCKERS_DETECTED');
  assert.equal(data.launchStatus,'NOT_VERIFIED');
  assert.ok(data.manualGates.some(x=>x.code==='PRODUCTION_RESTORE_DRILL'));
});

const cleanCounts = {
  ...detailCounts, published_places: 10, published_properties: 2,
  active_housing: 2, legacy_unstructured_housing: 0,
  stale_published_housing: 0, missing_housing_contact: 0,
  invalid_housing_price_area: 0, published_without_images: 0
};

test('CLI and Admin data gate share the same blocker policy for all public properties', async () => {
  for (const [column, blocker] of [
    ['legacy_unstructured_housing','LEGACY_UNSTRUCTURED_HOUSING'],
    ['invalid_housing_price_area','HOUSING_INVALID_PRICE_AREA'],
    ['stale_published_housing','STALE_PUBLISHED_HOUSING'],
    ['missing_housing_contact','HOUSING_MISSING_CONTACT'],
    ['published_places','NO_PUBLIC_PLACES']
  ]) {
    const row = { ...cleanCounts, [column]: column === 'published_places' ? 0 : 1 };
    const db = { query: async () => ({ rows: [row] }) };
    const admin = await queryPublicLaunchEvidence(db);
    const cli = await buildPublicLaunchAudit(db);
    assert.equal(cli.dataGate, 'NEEDS_REVIEW');
    assert.deepEqual(cli.blockers, admin.blockers);
    assert.ok(cli.blockers.includes(blocker));
    assert.equal(cli.launchStatus, 'NOT_VERIFIED');
    assert.equal(publicLaunchAuditExitCode(cli), 1);
    assert.equal(cli.realEstate.published_properties, 2);
  }
  const cli = await buildPublicLaunchAudit({ query: async () => ({ rows: [cleanCounts] }) });
  assert.equal(publicLaunchAuditExitCode(cli), 0);
  assert.equal(cli.launchStatus, 'NOT_VERIFIED');
  assert.ok(cli.manualGates.every(g => g.status === 'UNVERIFIED'));
  assert.equal(publicLaunchAuditExitCode({dataGate: 'UNKNOWN', blockers: []}), 1);
});

test('missing or invalid aggregate evidence is not interpreted as clean data', async () => {
  for (const rows of [[], [{ ...cleanCounts, invalid_housing_price_area: null }],
    [{ ...cleanCounts, legacy_unstructured_housing: -1 }],
    [{ ...cleanCounts, published_places: undefined }]]) {
    await assert.rejects(buildPublicLaunchAudit({query: async () => ({rows})}), /Invalid launch evidence/);
  }
});

test('PG16 audit counts legacy and incomplete public listings but ignores private records', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires isolated PG16 test database');
    return;
  }
  // Temporary tables shadow public tables only in this dedicated connection.
  // No production data, persistent schema changes, or shared fixture writes.
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(`CREATE TEMP TABLE categories (id int, slug text) ON COMMIT DROP;
      CREATE TEMP TABLE places (id int, category_id int, status text,
        address text, description text, phone text, last_verified_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE housing_listings (place_id int, listing_status text, expires_at timestamptz,
        area_m2 numeric, listing_type text, total_price_vnd bigint, monthly_rent numeric) ON COMMIT DROP;
      CREATE TEMP TABLE place_images (place_id int) ON COMMIT DROP;
      INSERT INTO categories VALUES (1,'bat-dong-san'),(2,'cafe');
      INSERT INTO places VALUES
        (1,1,'PUBLISHED','street','sale','111',NOW()),
        (2,1,'PUBLISHED','street','legacy','222',NOW()),
        (3,1,'PUBLISHED','street','',' ',NOW()),
        (4,1,'PENDING','street','','',NOW()),
        (5,2,'PUBLISHED','street','cafe','333',NOW());
      INSERT INTO housing_listings VALUES
        (1,'ACTIVE',NOW()+INTERVAL '1 day',50,'SALE',1000000000,NULL),
        (3,'ACTIVE',NOW()-INTERVAL '1 day',NULL,'RENT',NULL,0),
        (4,'PAUSED',NULL,NULL,'SALE',NULL,NULL);
      INSERT INTO place_images VALUES (1),(5)`);
    const audit = await buildPublicLaunchAudit(db);
    assert.equal(audit.published.published_total, 4);
    assert.deepEqual(audit.realEstate, {
      published_properties: 3, should_be_archived: 1,
      property_missing_description: 1, property_missing_images: 2,
      property_missing_contact: 1, legacy_unstructured_housing: 1,
      invalid_price_area: 1, active_housing: 1
    });
    assert.equal(audit.blockers.length, 4);
    assert.equal(publicLaunchAuditExitCode(audit), 1);
    assert.equal(JSON.stringify(audit).includes('"222"'), false);
  } finally {
    try { await db.query('ROLLBACK'); } finally { db.release(); }
  }
});
