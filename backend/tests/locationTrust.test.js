import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveVerificationFreshness } from '../src/services/placeTrust.service.js';
import { createContributionSchema } from '../src/validators/contribution.validators.js';
import { buildContributionFingerprint } from '../src/services/contributionTrust.service.js';

test('Location Trust freshness warns when a place has never been verified', () => {
  const result = deriveVerificationFreshness(null, new Date('2026-11-07T00:00:00.000Z'));
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.isStale, true);
  assert.equal(result.ageDays, null);
});

test('Location Trust freshness stays current through day 180 and becomes stale after it', () => {
  const now = new Date('2026-11-07T00:00:00.000Z');
  const fresh = deriveVerificationFreshness(new Date(now.getTime() - 180 * 86400000), now);
  const stale = deriveVerificationFreshness(new Date(now.getTime() - 181 * 86400000), now);
  assert.equal(fresh.status, 'FRESH');
  assert.equal(fresh.isStale, false);
  assert.equal(stale.status, 'STALE');
  assert.equal(stale.isStale, true);
});

test('Location Trust reports identify the affected field and preserve a suggested correction', () => {
  const result = createContributionSchema.safeParse({
    type: 'REPORT_WRONG_INFO',
    placeId: 42,
    fieldKey: 'OPENING_HOURS',
    suggestedValue: '08:00–22:00',
    place: { openingHours: '08:00–22:00' },
    reason: 'Giờ mở cửa trên trang đã cũ.'
  });
  assert.equal(result.success, true);
});

test('Location Trust field reports require a reason and cannot target unrelated contribution types', () => {
  const missingReason = createContributionSchema.safeParse({
    type: 'REPORT_WRONG_INFO',
    placeId: 42,
    fieldKey: 'PHONE',
    suggestedValue: '0241234567'
  });
  const wrongType = createContributionSchema.safeParse({
    type: 'UPDATE_HOURS',
    placeId: 42,
    fieldKey: 'PHONE',
    reason: 'Số điện thoại sai.'
  });
  assert.equal(missingReason.success, false);
  assert.equal(wrongType.success, false);
});


test('Location Trust report fingerprints distinguish address, hours and phone corrections', () => {
  const base = {
    type: 'REPORT_WRONG_INFO',
    placeId: 42,
    payload: { reason: 'Thông tin hiện tại sai.' }
  };
  const phone = buildContributionFingerprint({
    ...base,
    payload: { ...base.payload, fieldKey: 'PHONE', suggestedValue: '0241234567' }
  });
  const address = buildContributionFingerprint({
    ...base,
    payload: { ...base.payload, fieldKey: 'ADDRESS', suggestedValue: 'Khu Công nghệ cao Hòa Lạc' }
  });
  assert.notEqual(phone, address);
});
