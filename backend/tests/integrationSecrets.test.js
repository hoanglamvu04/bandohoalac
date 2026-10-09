import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  maskIntegrationSecret,
  normalizeIntegrationProvider
} from '../src/services/integrationSecrets.service.js';

test('integration secret encryption round-trips without exposing plaintext', () => {
  const secret = 'fsq_demo_service_key_1234567890';
  const encrypted = encryptIntegrationSecret(secret, 'FOURSQUARE');

  assert.notEqual(encrypted.ciphertext, secret);
  assert.equal(encrypted.ciphertext.includes(secret), false);
  assert.ok(encrypted.iv.length > 8);
  assert.ok(encrypted.authTag.length > 8);
  assert.equal(decryptIntegrationSecret(encrypted, 'FOURSQUARE'), secret);
});

test('integration secret ciphertext is bound to its provider AAD', () => {
  const encrypted = encryptIntegrationSecret('another-demo-secret-12345', 'FOURSQUARE');
  assert.throws(() => decryptIntegrationSecret(encrypted, 'UNKNOWN'));
});

test('integration secret mask only exposes the final four characters', () => {
  assert.equal(maskIntegrationSecret('abcdefgh1234'), '••••••••1234');
  assert.equal(maskIntegrationSecret(''), null);
});

test('provider normalization is stable', () => {
  assert.equal(normalizeIntegrationProvider(' foursquare '), 'FOURSQUARE');
});
