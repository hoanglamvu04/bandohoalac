import test from 'node:test';
import assert from 'node:assert/strict';
import {
  foursquareClassificationScore,
  normalizePhotoText,
  photoNameSimilarity
} from '../src/services/photoScanner.service.js';

test('photo name similarity recognizes the same place name inside a Commons file title', () => {
  const score = photoNameSimilarity(
    'The Lake Coffee',
    'File:The Lake Coffee Hoa Lac exterior.jpg'
  );
  assert.ok(score > 0.6);
});

test('photo text normalization removes accents and file suffix noise', () => {
  assert.equal(
    normalizePhotoText('File:Hồ Tân Xã - Hòa Lạc.JPG'),
    'ho tan xa hoa lac'
  );
});

test('Foursquare storefront photos outrank food photos and logos are rejected', () => {
  assert.ok(
    foursquareClassificationScore(['outdoor_or_storefront']) >
    foursquareClassificationScore(['food_or_drink'])
  );
  assert.equal(foursquareClassificationScore(['logos']), -1);
  assert.equal(foursquareClassificationScore(['menu']), -1);
});
