import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExpertise,
  contributionDomain,
  detectAreaFromAddress,
  expertisePriorityBoost
} from '../src/services/expertise.service.js';

const NOW = new Date('2026-10-06T00:00:00Z');

function daysAgo(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

test('maps contribution types into expertise domains', () => {
  assert.equal(contributionDomain('FIX_LOCATION').key, 'LOCATION');
  assert.equal(contributionDomain('REPORT_FLOOD').key, 'ROAD_SAFETY');
  assert.equal(contributionDomain('ADD_PHOTO').key, 'MEDIA');
  assert.equal(contributionDomain('UPDATE_HOURS').key, 'LOCAL_INFO');
});

test('detects supported local areas from Vietnamese addresses', () => {
  assert.equal(detectAreaFromAddress('Xã Hạ Bằng, Thạch Thất, Hà Nội')?.key, 'HA_BANG');
  assert.equal(detectAreaFromAddress('Phú Cát, Quốc Oai, Hà Nội')?.key, 'PHU_CAT');
  assert.equal(detectAreaFromAddress('Yên Xuân, Thạch Thất')?.key, 'YEN_XUAN');
  assert.equal(detectAreaFromAddress('Hà Đông, Hà Nội'), null);
});

test('expertise cannot be reached from volume alone', () => {
  const lowQuality = calculateExpertise({
    approvedCount: 30,
    rejectedCount: 20,
    qualityPoints: 60,
    lastReviewedAt: daysAgo(5)
  }, NOW);
  assert.notEqual(lowQuality.tier, 'EXPERT');
});

test('specialist and expert require evidence, quality and accuracy', () => {
  const specialist = calculateExpertise({
    approvedCount: 8,
    rejectedCount: 2,
    qualityPoints: 75,
    lastReviewedAt: daysAgo(20)
  }, NOW);
  assert.equal(specialist.tier, 'SPECIALIST');

  const expert = calculateExpertise({
    approvedCount: 18,
    rejectedCount: 2,
    qualityPoints: 180,
    lastReviewedAt: daysAgo(10)
  }, NOW);
  assert.equal(expert.tier, 'EXPERT');
  assert.ok(expert.score >= 70);
});

test('old expertise loses recency score but does not erase evidence', () => {
  const fresh = calculateExpertise({
    approvedCount: 15,
    rejectedCount: 1,
    qualityPoints: 150,
    lastReviewedAt: daysAgo(10)
  }, NOW);
  const stale = calculateExpertise({
    approvedCount: 15,
    rejectedCount: 1,
    qualityPoints: 150,
    lastReviewedAt: daysAgo(500)
  }, NOW);

  assert.ok(fresh.score > stale.score);
  assert.equal(fresh.metrics.approvedCount, stale.metrics.approvedCount);
});

test('expertise priority boost is bounded and reputation-gated', () => {
  const expertise = { tier: 'EXPERT' };
  assert.equal(expertisePriorityBoost({
    expertise,
    reputation: { code: 'TRUSTED_CONTRIBUTOR', confidence: { score: 75 } }
  }), 1);
  assert.equal(expertisePriorityBoost({
    expertise,
    reputation: { code: 'EXPLORER', confidence: { score: 90 } }
  }), 0);
  assert.equal(expertisePriorityBoost({
    expertise,
    reputation: { code: 'LOCAL_EXPERT', confidence: { score: 40 } }
  }), 0);
});
