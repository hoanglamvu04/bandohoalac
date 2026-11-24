import assert from 'node:assert/strict';
import test from 'node:test';
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
      published_places:200, active_housing:30,
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
      published_places:30,active_housing:10,legacy_unstructured_housing:0,
      stale_published_housing:0,missing_housing_contact:0,
      invalid_housing_price_area:0,published_without_images:0
    }]};}
  });
  assert.equal(data.dataGate,'NO_BLOCKERS_DETECTED');
  assert.equal(data.launchStatus,'NOT_VERIFIED');
  assert.ok(data.manualGates.some(x=>x.code==='PRODUCTION_RESTORE_DRILL'));
});
