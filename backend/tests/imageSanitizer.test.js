import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { uploadRoot } from '../src/middleware/upload.js';
import { storeUploadedFiles, deleteStoredAssets } from '../src/services/storage.service.js';
import { env } from '../src/config/env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeUploadedImage } from '../src/services/imageSanitizer.service.js';

const codecAvailable = spawnSync('cwebp', ['-version'], { stdio: 'ignore' }).status === 0;
const pngWithPrivateMetadata = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAJHRFWHRTb3VyY2VHUFMAU0VOU0lUSVZFX0dQU18yMS4wMV8xMDUuNTJ9xYppAAAAFklEQVR4nGPkqHjGwMDAxMDAwMDAAAAQFAFq2fdUdgAAAABJRU5ErkJggg==',
  'base64'
);

function uploaded(buffer) {
  return {
    buffer,
    mimetype: 'image/png',
    detectedWidth: 2,
    detectedHeight: 2
  };
}

test('image sanitizer strips private metadata before storage', { skip: !codecAvailable }, async () => {
  assert.ok(pngWithPrivateMetadata.includes(Buffer.from('SENSITIVE_GPS_')));
  const clean = await sanitizeUploadedImage(uploaded(pngWithPrivateMetadata));
  assert.equal(clean.toString('ascii', 0, 4), 'RIFF');
  assert.equal(clean.toString('ascii', 8, 12), 'WEBP');
  assert.equal(clean.includes(Buffer.from('SENSITIVE_GPS_')), false);
  assert.equal(clean.includes(Buffer.from('EXIF')), false);
});

test('image sanitizer decodes instead of trusting file headers', { skip: !codecAvailable }, async () => {
  await assert.rejects(
    sanitizeUploadedImage(uploaded(Buffer.from('not an image'))),
    /không hợp lệ|không thể xử lý/i
  );
});

test('image sanitizer requires validated dimensions', async () => {
  await assert.rejects(
    sanitizeUploadedImage({ buffer: pngWithPrivateMetadata }),
    /kích thước/i
  );
});

test('local non-place uploads store only a sanitized asset, not the original', {
  skip: !codecAvailable || env.uploadProvider !== 'local'
}, async () => {
  const filename = randomUUID() + '.png';
  const source = path.join(uploadRoot, filename);
  await writeFile(source, pngWithPrivateMetadata, { mode: 0o600 });
  let assets = [];
  try {
    assets = await storeUploadedFiles([{
      filename,
      path: source,
      mimetype: 'image/png',
      detectedWidth: 2,
      detectedHeight: 2
    }], { scope: 'brand' });
    assert.equal(assets.length, 1);
    assert.equal(assets[0].provider, 'local');
    assert.ok(assets[0].filename.endsWith('-clean.webp'));
    const stored = await readFile(path.join(uploadRoot, assets[0].filename));
    assert.equal(stored.toString('ascii', 0, 4), 'RIFF');
    assert.equal(stored.includes(Buffer.from('SENSITIVE_GPS_')), false);
    await assert.rejects(access(source), (error) => error.code === 'ENOENT');
  } finally {
    await deleteStoredAssets(assets);
    await rm(source, { force: true });
  }
});
