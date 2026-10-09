import test from 'node:test';
import assert from 'node:assert/strict';
import { isFoursquareMatchAcceptable } from '../src/services/photoScannerV2.service.js';

test('nearby Foursquare result may tolerate small naming differences', () => {
  assert.equal(
    isFoursquareMatchAcceptable('The Lake Coffee Hòa Lạc', 'The Lake Coffee', 120),
    true
  );
});

test('farther Foursquare result requires a much stronger name match', () => {
  assert.equal(
    isFoursquareMatchAcceptable('Cafe Xanh Hòa Lạc', 'Nhà hàng Hoàng Gia', 650),
    false
  );
});

test('very distant results are rejected even with a similar name', () => {
  assert.equal(
    isFoursquareMatchAcceptable('Highlands Coffee', 'Highlands Coffee', 1500),
    false
  );
});
