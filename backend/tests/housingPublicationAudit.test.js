import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/database/pool.js';
import {
  inspectHousingImageUrl, auditHousingPublication
} from '../src/scripts/auditHousingPublication.js';

const base = 'https://maps.dothihoalac.vn';

test('image audit verifies safe local files and rejects dangerous or wrong-host paths', async () => {
  const existing = [];
  const options = {
    publicBaseUrl: base,
    uploadDir: '/var/www/secured-uploads',
    fileStat: async (file) => {
      existing.push(file);
      if (file.endsWith('/present-card.webp')) {
        return { isFile: () => true, size: 8192 };
      }
      const error = new Error('missing');
      error.code = 'ENOENT';
      throw error;
    }
  };

  assert.equal(await inspectHousingImageUrl(base + '/uploads/present-card.webp', options), 'LOCAL_FILE_OK');
  assert.equal(await inspectHousingImageUrl(base + '/uploads/missing-card.webp', options), 'LOCAL_FILE_MISSING');
  assert.equal(await inspectHousingImageUrl('https://other.example/uploads/asset.webp', options), 'PUBLIC_ORIGIN_MISMATCH');
  assert.equal(await inspectHousingImageUrl('javascript:alert(1)', options), 'INVALID_URL');
  assert.equal(await inspectHousingImageUrl(base + '/uploads/%2e%2e%2fsecret.webp', options), 'INVALID_URL');
  assert.equal(await inspectHousingImageUrl('https://res.cloudinary.com/demo/image/upload/photo.jpg', options), 'REMOTE_UNVERIFIED');
  assert.equal(await inspectHousingImageUrl('', options), 'MISSING_URL');
  assert.deepEqual(existing, [
    '/var/www/secured-uploads/present-card.webp',
    '/var/www/secured-uploads/missing-card.webp'
  ]);
});

test('housing audit counts visibility faults and missing media without publishing private details', async () => {
  const rows = [
    { id: '801', status: 'PUBLISHED', inside_coverage: true, lat: 21.01354, lng: 105.52522,
      housing_id: '801', listing_status: 'ACTIVE', expires_at: '2035-11-20T00:00:00Z',
      images: [{ url: base + '/uploads/present-card.webp',
        thumbnailUrl: base + '/uploads/missing-thumb.webp',
        cardUrl: base + '/uploads/present-card.webp' }] },
    { id: '802', status: 'PUBLISHED', inside_coverage: false, lat: 15.8, lng: 105.3,
      housing_id: null, listing_status: null, expires_at: null, images: [] },
    { id: '803', status: 'PUBLISHED', inside_coverage: true, lat: 21.014, lng: 105.526,
      housing_id: '803', listing_status: 'SOLD', expires_at: null,
      images: [{ url: 'https://res.cloudinary.com/demo/image/upload/a.jpg' }] }
  ];
  const result = await auditHousingPublication({
    limit: 3,
    client: { query: async (_sql, params) => {
      assert.equal(params[1], 3);
      return { rows };
    } },
    publicBaseUrl: base,
    uploadDir: '/var/www/secured-uploads',
    fileStat: async (filename) => {
      if (filename.endsWith('present-card.webp')) return {
        isFile: () => true, size: 2000
      };
      throw new Error('missing');
    }
  });

  assert.equal(result.mode, 'READ_ONLY');
  assert.equal(result.summary.publishedPropertiesChecked, 3);
  assert.equal(result.summary.mapAndHousingReady, 1);
  assert.equal(result.summary.missingHousingProfiles, 1);
  assert.equal(result.summary.outsideCoverage, 1);
  assert.equal(result.summary.hiddenOrExpiredListings, 1);
  assert.equal(result.summary.propertiesWithoutPhotos, 1);
  assert.equal(result.summary.missingLocalFiles, 1);
  assert.equal(result.summary.remoteMediaNotVerified, 1);
  assert.equal(result.releaseBlockers, 4);
  assert.deepEqual(result.sampleIssues.map((item) => item.placeId), [801, 802, 803]);
  assert.equal(JSON.stringify(result).includes('https://res.cloudinary.com'), false);
});

test('production audit query is compatible with migrated PG16/PostGIS', async (t) => {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
    t.skip('requires isolated PG16 test database');
    return;
  }
  const result = await auditHousingPublication({ client: pool, limit: 1 });
  assert.equal(result.mode, 'READ_ONLY');
  assert.ok(Number.isInteger(result.summary.publishedPropertiesChecked));
});
