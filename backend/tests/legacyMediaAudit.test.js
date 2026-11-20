import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  classifyPublicImageAsset,
  collectLegacyMediaAudit,
  scanLegacyLocalUploads
} from '../src/scripts/auditLegacyMedia.js';

const base = 'https://maps.dothihoalac.vn';

test('legacy asset classification never treats Cloudinary transformation as a verified original', () => {
  assert.equal(classifyPublicImageAsset({
    url: 'https://res.cloudinary.com/example/image/upload/w_300,f_auto/x.jpg',
    storage_provider: 'cloudinary'
  }, base), 'CLOUDINARY_ORIGINAL_UNVERIFIED');
  assert.equal(classifyPublicImageAsset({
    url: base + '/uploads/private-original.jpg',
    storage_provider: 'local'
  }, base), 'LOCAL_RAW_PUBLIC');
  assert.equal(classifyPublicImageAsset({
    url: '/uploads/1234-card.webp'
  }, base), 'LOCAL_VARIANT_REVIEW');
  assert.equal(classifyPublicImageAsset({
    url: '/uploads/1234.webp'
  }, base), 'LOCAL_OTHER_UNVERIFIED');
  assert.equal(classifyPublicImageAsset({
    url: 'https://external.example/test.jpg'
  }, base), 'EXTERNAL_UNVERIFIED');
  assert.equal(classifyPublicImageAsset({
    url: '/uploads/..%2Fsecret.jpg'
  }, base), 'INVALID_URL');
});

test('read-only raw-format scan reports metadata markers without touching files', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hola-media-audit-'));
  try {
    await writeFile(path.join(dir, 'old-photo.jpg'), Buffer.from('HEADER Exif\0\0 GPSInfo'));
    await writeFile(path.join(dir, 'no-meta.png'), Buffer.from('raw image bytes'));
    await writeFile(path.join(dir, 'safe-card.webp'), Buffer.from('RIFF'));
    const result = await scanLegacyLocalUploads(dir);
    assert.equal(result.totalFiles, 3);
    assert.equal(result.rawFormatFiles, 2);
    assert.equal(result.metadataMarkerFiles, 1);
    assert.equal(result.truncated, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('audit produces aggregate counts without exposing private file URLs', async () => {
  const rows = [
    { id: 1, url: '/uploads/a.jpg', storage_provider: 'local' },
    { id: 2, url: 'https://res.cloudinary.com/example/image/upload/test', storage_provider: 'cloudinary' }
  ];
  const client = { query: async (sql) => sql.includes('COUNT(*)')
    ? { rows: [{ total: 2 }] }
    : { rows } };
  const report = await collectLegacyMediaAudit({
    client,
    publicBaseUrl: base,
    uploadProvider: 'cloudinary',
    limit: 100
  });
  assert.equal(report.classifications.LOCAL_RAW_PUBLIC, 1);
  assert.equal(report.classifications.CLOUDINARY_ORIGINAL_UNVERIFIED, 1);
  assert.equal(report.imageRecordsAudited, 2);
  assert.equal(report.localDisk, null);
  assert.equal(JSON.stringify(report).includes('a.jpg'), false);
  assert.ok(report.launchWarnings.length > 0);
});
