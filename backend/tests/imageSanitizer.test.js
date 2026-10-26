import { spawnSync } from 'node:child_process';
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
