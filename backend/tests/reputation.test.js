import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReputation,
  getReputationPermissions
} from '../src/services/reputation.service.js';

const NOW = new Date('2026-10-05T00:00:00Z');

function createdDaysAgo(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

test('new users remain new even with reward-like quality points but no approved history', () => {
  const reputation = calculateReputation({
    qualityPoints: 1000,
    approvedCount: 0,
    rejectedCount: 0,
    trustScore: 90,
    createdAt: createdDaysAgo(365)
  }, NOW);

  assert.equal(reputation.code, 'NEW_MEMBER');
  assert.ok(reputation.score > 0);
  assert.ok(reputation.blockers.some((item) => item.key === 'approvedCount'));
});

test('explorer requires approved contributions, not just points', () => {
  const reputation = calculateReputation({
    qualityPoints: 30,
    approvedCount: 2,
    rejectedCount: 0,
    trustScore: 50,
    createdAt: createdDaysAgo(30),
    lastReviewedAt: createdDaysAgo(1)
  }, NOW);

  assert.equal(reputation.code, 'EXPLORER');
});

test('trusted contributor requires quality, approval rate, trust and tenure gates', () => {
  const notTrusted = calculateReputation({
    qualityPoints: 400,
    approvedCount: 22,
    rejectedCount: 10,
    trustScore: 60,
    createdAt: createdDaysAgo(60),
    lastReviewedAt: createdDaysAgo(2)
  }, NOW);
  assert.notEqual(notTrusted.code, 'TRUSTED_CONTRIBUTOR');

  const trusted = calculateReputation({
    qualityPoints: 420,
    approvedCount: 28,
    rejectedCount: 4,
    trustScore: 78,
    createdAt: createdDaysAgo(90),
    lastReviewedAt: createdDaysAgo(2)
  }, NOW);
  assert.equal(trusted.code, 'TRUSTED_CONTRIBUTOR');
});

test('local expert cannot be reached by quality points alone', () => {
  const almost = calculateReputation({
    qualityPoints: 2000,
    approvedCount: 70,
    rejectedCount: 15,
    trustScore: 79,
    createdAt: createdDaysAgo(200),
    lastReviewedAt: createdDaysAgo(3)
  }, NOW);
  assert.notEqual(almost.code, 'LOCAL_EXPERT');

  const expert = calculateReputation({
    qualityPoints: 900,
    approvedCount: 80,
    rejectedCount: 8,
    trustScore: 90,
    createdAt: createdDaysAgo(200),
    lastReviewedAt: createdDaysAgo(3)
  }, NOW);
  assert.equal(expert.code, 'LOCAL_EXPERT');
  assert.ok(expert.score >= 80);
  assert.equal(expert.nextLevel, null);
});

test('reputation score is always capped at 100', () => {
  const reputation = calculateReputation({
    qualityPoints: 999999,
    approvedCount: 9999,
    rejectedCount: 0,
    trustScore: 999,
    createdAt: createdDaysAgo(9999),
    lastReviewedAt: createdDaysAgo(1),
    scoreAdjustment: 15
  }, NOW);
  assert.equal(reputation.score, 100);
});

test('same activity volume produces different reputation when contribution quality differs', () => {
  const lowQuality = calculateReputation({
    qualityPoints: 80,
    approvedCount: 30,
    rejectedCount: 3,
    trustScore: 80,
    createdAt: createdDaysAgo(120),
    lastReviewedAt: createdDaysAgo(2)
  }, NOW);
  const highQuality = calculateReputation({
    qualityPoints: 500,
    approvedCount: 30,
    rejectedCount: 3,
    trustScore: 80,
    createdAt: createdDaysAgo(120),
    lastReviewedAt: createdDaysAgo(2)
  }, NOW);

  assert.ok(highQuality.score > lowQuality.score);
  assert.ok(highQuality.components.quality > lowQuality.components.quality);
});

test('Reputation v2.2 keeps self approval disabled at every level', () => {
  const standard = getReputationPermissions('NEW_MEMBER');
  const trusted = getReputationPermissions('TRUSTED_CONTRIBUTOR');
  const expert = getReputationPermissions('LOCAL_EXPERT');

  assert.equal(standard.expeditedReview, false);
  assert.equal(trusted.expeditedReview, true);
  assert.ok(expert.moderationPriority > trusted.moderationPriority);
  assert.equal(standard.selfApproval, false);
  assert.equal(trusted.selfApproval, false);
  assert.equal(expert.selfApproval, false);
});

test('calculated reputation exposes v2.2 confidence and permissions', () => {
  const reputation = calculateReputation({
    qualityPoints: 420,
    approvedCount: 28,
    rejectedCount: 4,
    trustScore: 78,
    createdAt: createdDaysAgo(90),
    lastReviewedAt: createdDaysAgo(2)
  }, NOW);

  assert.equal(reputation.version, '2.2');
  assert.equal(reputation.permissions.priorityLabel, 'Ưu tiên cao');
  assert.equal(reputation.permissions.selfApproval, false);
  assert.ok(reputation.confidence.score >= 70);
  assert.equal(reputation.freshness.state, 'ACTIVE');
});

test('inactive accounts receive a small freshness decay without touching base score', () => {
  const active = calculateReputation({
    qualityPoints: 700,
    approvedCount: 60,
    rejectedCount: 5,
    trustScore: 88,
    createdAt: createdDaysAgo(500),
    lastReviewedAt: createdDaysAgo(7)
  }, NOW);
  const dormant = calculateReputation({
    qualityPoints: 700,
    approvedCount: 60,
    rejectedCount: 5,
    trustScore: 88,
    createdAt: createdDaysAgo(500),
    lastReviewedAt: createdDaysAgo(500)
  }, NOW);

  assert.equal(active.baseScore, dormant.baseScore);
  assert.equal(dormant.freshness.penalty, 8);
  assert.equal(active.score - dormant.score, 8);
  assert.ok(dormant.stability.reasons.includes('INACTIVITY_DECAY'));
});

test('confidence can gate sensitive privileges even when score reaches trusted level', () => {
  const reputation = calculateReputation({
    qualityPoints: 380,
    approvedCount: 20,
    rejectedCount: 6,
    trustScore: 65,
    createdAt: createdDaysAgo(120),
    lastReviewedAt: null
  }, NOW);

  assert.equal(reputation.code, 'TRUSTED_CONTRIBUTOR');
  assert.ok(reputation.confidence.score < 70);
  assert.equal(reputation.permissions.sensitiveCorrections, false);
  assert.equal(reputation.permissions.selfApproval, false);
});

test('admin score adjustment is bounded and permission ceiling can only restrict privileges', () => {
  const reputation = calculateReputation({
    qualityPoints: 900,
    approvedCount: 80,
    rejectedCount: 4,
    trustScore: 95,
    createdAt: createdDaysAgo(500),
    lastReviewedAt: createdDaysAgo(1),
    scoreAdjustment: -999,
    permissionCeiling: 'CONTRIBUTOR'
  }, NOW);

  assert.equal(reputation.adjustments.manual, -15);
  assert.equal(reputation.permissions.permissionCode, 'CONTRIBUTOR');
  assert.ok(reputation.permissions.moderationPriority <= 2);
  assert.equal(reputation.permissions.sensitiveCorrections, false);
  assert.equal(reputation.permissions.selfApproval, false);
});
