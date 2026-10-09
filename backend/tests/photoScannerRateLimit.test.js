import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRetryAfterMs } from '../src/services/photoScannerV3.service.js';

function headers(values) {
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)])
  );
  return {
    get(name) {
      return normalized[String(name).toLowerCase()] ?? null;
    }
  };
}

test('Retry-After seconds are converted to milliseconds', () => {
  assert.equal(parseRetryAfterMs(headers({ 'Retry-After': '7' }), 1_000), 7_000);
});

test('Retry-After HTTP date is respected', () => {
  const now = Date.parse('2026-10-09T10:00:00Z');
  const retryAt = 'Fri, 09 Oct 2026 10:00:12 GMT';
  assert.equal(parseRetryAfterMs(headers({ 'Retry-After': retryAt }), now), 12_000);
});

test('X-RateLimit-Reset is used as a fallback', () => {
  const now = Date.parse('2026-10-09T10:00:00Z');
  const resetSeconds = Math.floor((now + 15_000) / 1000);
  assert.equal(parseRetryAfterMs(headers({ 'X-RateLimit-Reset': resetSeconds }), now), 15_000);
});
