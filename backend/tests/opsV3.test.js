import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/database/pool.js';
import { getDataQualityOverview } from '../src/services/dataQuality.service.js';
import { getHaloSyncMonitor } from '../src/services/haloSyncMonitor.service.js';

after(async () => {
  await pool.end();
});

test('Data Quality V3 returns coverage and duplicate/coordinate counters', async () => {
  const data = await getDataQualityOverview({ limit: 20 });
  assert.ok(data?.summary);
  assert.equal(typeof data.summary.totalPublished, 'number');
  assert.equal(typeof data.summary.possibleDuplicates, 'number');
  assert.equal(typeof data.summary.missingCoordinates, 'number');
  assert.ok(Array.isArray(data?.coverage?.areas));
  assert.equal(data.coverage.areas.length, 8);
  assert.ok(Array.isArray(data.items));
});

test('HALO Sync Monitor returns stable operational summary', async () => {
  const data = await getHaloSyncMonitor({ limit: 5 });
  assert.equal(data.ok, true);
  assert.equal(typeof data.summary.publishedPosts, 'number');
  assert.equal(typeof data.summary.deletedPosts, 'number');
  assert.equal(typeof data.summary.activeSpots, 'number');
  assert.equal(typeof data.summary.activeMedia, 'number');
  assert.ok(Array.isArray(data.recent));
  assert.ok(data.recent.length <= 5);
});
