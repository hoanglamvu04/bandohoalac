import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/database/pool.js';
import { getDataQualityOverview } from '../src/services/dataQuality.service.js';
import { getHaloSyncMonitor } from '../src/services/haloSyncMonitor.service.js';

after(async () => {
  await pool.end();
});

test('Data Quality V3 returns coverage, duplicate and boundary counters', async () => {
  const data = await getDataQualityOverview({ limit: 20 });
  assert.equal(data.version, 3);
  assert.ok(data?.summary);
  assert.equal(typeof data.summary.totalPublished, 'number');
  assert.equal(typeof data.summary.possibleDuplicates, 'number');
  assert.equal(typeof data.summary.missingCoordinates, 'number');
  assert.equal(typeof data.summary.outOfCoverage, 'number');
  assert.equal(data.thresholds.duplicateDistanceMeters, 120);
  assert.ok(Array.isArray(data?.coverage?.areas));
  assert.equal(data.coverage.areas.length, 8);
  assert.ok(Array.isArray(data.items));
});

test('HALO Sync Monitor V3 returns stable operational and integrity summary', async () => {
  const data = await getHaloSyncMonitor({ limit: 5 });
  assert.equal(data.ok, true);
  assert.equal(data.version, 3);
  assert.equal(typeof data.summary.publishedPosts, 'number');
  assert.equal(typeof data.summary.deletedPosts, 'number');
  assert.equal(typeof data.summary.activeSpots, 'number');
  assert.equal(typeof data.summary.activeMedia, 'number');
  assert.equal(typeof data.summary.publishedWithoutSpot, 'number');
  assert.equal(typeof data.summary.publishedWithoutMedia, 'number');
  assert.equal(typeof data.summary.unstableMediaUrls, 'number');
  assert.ok(['HEALTHY', 'ATTENTION', 'IDLE'].includes(data.health.status));
  assert.equal(typeof data.health.integrityIssueCount, 'number');
  assert.ok(Array.isArray(data.recent));
  assert.ok(data.recent.length <= 5);
});
