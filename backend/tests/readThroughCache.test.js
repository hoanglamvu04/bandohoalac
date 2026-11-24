import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadThroughCache } from '../src/utils/readThroughCache.js';

test('Sprint 15 public market cache coalesces same-key concurrent requests', async () => {
  let calls = 0, clock = 0;
  const cache = createReadThroughCache({ now:()=>clock, ttlMs:60000, maxEntries:2 });
  const load = async () => { calls++; return { median:12000000 }; };
  const values = await Promise.all([cache('LAND:SALE',load),
    cache('LAND:SALE',load),cache('LAND:SALE',load)]);
  assert.equal(calls,1);
  assert.equal(values.length,3);
  assert.equal((await cache('LAND:SALE',load)).median,12000000);
  assert.equal(calls,1);
  clock += 60001;
  await cache('LAND:SALE',load);
  assert.equal(calls,2);
});

test('Sprint 15 cache is bounded, independently keyed and retries errors', async () => {
  let clock=0, calls=0;
  const cache=createReadThroughCache({ now:()=>clock,ttlMs:100,maxEntries:2 });
  const load=async()=>{calls++;return { id:calls };};
  await cache('A',load);
  await cache('B',load);
  await cache('C',load);
  assert.equal(cache.stats().cached,2);
  await cache('A',load);
  assert.equal(calls,4,'oldest entry evicted');
  await assert.rejects(()=>cache('FAILED',async()=>{ throw new Error('pg unavailable'); }),
    /pg unavailable/);
  assert.deepEqual(cache.stats(),{ cached:2,inFlight:0 });
  assert.equal((await cache('FAILED',load)).id,5,'failed cache never poisons retry');
  assert.equal(cache.stats().cached,2);
  cache.clear();
  assert.equal(cache.stats().cached,0);
  clock+=101;
});

test('Sprint 15 rejects invalid unsafe cache keys and limits', async () => {
  assert.throws(()=>createReadThroughCache({maxEntries:0}),TypeError);
  assert.throws(()=>createReadThroughCache({ttlMs:-2}),TypeError);
  const cache=createReadThroughCache();
  await assert.rejects(()=>cache('',async()=>1),TypeError);
  await assert.rejects(()=>cache('x'.repeat(513),async()=>1),TypeError);
  await assert.rejects(()=>cache('x',null),TypeError);
});
