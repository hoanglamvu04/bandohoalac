import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContributionFingerprint,
  computeCtvTrust,
  contributionRiskBand,
  assertCtvCanModerate
} from '../src/services/contributionTrust.service.js';

const basePayload = {
  place: { name: 'Cafe Hola', address: 'Hòa Lạc' },
  location: { lat: 21.0123456, lng: 105.5123456 },
  reason: 'Thông tin mới'
};

test('contribution fingerprint is stable for equivalent text and coordinates', () => {
  const a = buildContributionFingerprint({
    type: 'CREATE_PLACE',
    placeId: null,
    payload: basePayload
  });
  const b = buildContributionFingerprint({
    type: 'CREATE_PLACE',
    placeId: null,
    payload: {
      ...basePayload,
      place: { name: '  CAFE HOLA ', address: 'Hoà Lạc' },
      location: { lat: 21.01234561, lng: 105.51234561 }
    }
  });
  assert.equal(a, b);
});

test('risk bands classify low medium and high', () => {
  assert.equal(contributionRiskBand(0), 'LOW');
  assert.equal(contributionRiskBand(39), 'LOW');
  assert.equal(contributionRiskBand(40), 'MEDIUM');
  assert.equal(contributionRiskBand(69), 'MEDIUM');
  assert.equal(contributionRiskBand(70), 'HIGH');
});

test('CTV trust promotes to level 2 only after enough audited reviews', () => {
  assert.deepEqual(computeCtvTrust({ reviews: 19, confirmed: 19, overturned: 0 }), {
    score: 98,
    level: 1
  });
  assert.deepEqual(computeCtvTrust({ reviews: 20, confirmed: 10, overturned: 0 }), {
    score: 80,
    level: 2
  });
  assert.deepEqual(computeCtvTrust({ reviews: 30, confirmed: 20, overturned: 3 }), {
    score: 70,
    level: 1
  });
});

test('CTV level 1 cannot moderate high-risk or high-impact contributions', () => {
  const ctv1 = { id: 10, role: 'CTV', ctvLevel: 1 };
  assert.equal(assertCtvCanModerate(ctv1, { type: 'UPDATE_HOURS', risk_score: 20 }), true);
  assert.throws(
    () => assertCtvCanModerate(ctv1, { type: 'UPDATE_HOURS', risk_score: 55 }),
    /CTV cấp 2/
  );
  assert.throws(
    () => assertCtvCanModerate(ctv1, { type: 'REPORT_CLOSED', risk_score: 10 }),
    /CTV cấp 2/
  );
});

test('CTV level 2 and higher staff can moderate high-risk contributions', () => {
  assert.equal(assertCtvCanModerate({ id: 11, role: 'CTV', ctvLevel: 2 }, { type: 'REPORT_CLOSED', risk_score: 90 }), true);
  assert.equal(assertCtvCanModerate({ id: 12, role: 'MODERATOR' }, { type: 'REPORT_CLOSED', risk_score: 100 }), true);
  assert.equal(assertCtvCanModerate({ id: 13, role: 'ADMIN' }, { type: 'REPORT_CLOSED', risk_score: 100 }), true);
});
