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

test('integration secret authentication rejects tampered ciphertext', () => {
  const encrypted = encryptIntegrationSecret('another-demo-secret-12345', 'FOURSQUARE');
  const bytes = Buffer.from(encrypted.ciphertext, 'base64');
  bytes[0] ^= 1;

  assert.throws(() => decryptIntegrationSecret({
    ...encrypted,
    ciphertext: bytes.toString('base64')
  }, 'FOURSQUARE'));
});

test('integration secret mask only exposes the final four characters', () => {
  assert.equal(maskIntegrationSecret('abcdefgh1234'), '••••••••1234');
  assert.equal(maskIntegrationSecret(''), null);
});

test('provider normalization is stable', () => {
  assert.equal(normalizeIntegrationProvider(' foursquare '), 'FOURSQUARE');
});
