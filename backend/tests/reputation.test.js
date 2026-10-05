import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReputation } from '../src/services/reputation.service.js';

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
    createdAt: createdDaysAgo(30)
  }, NOW);

  assert.equal(reputation.code, 'EXPLORER');
});

test('trusted contributor requires quality, approval rate, trust and tenure gates', () => {
  const notTrusted = calculateReputation({
    qualityPoints: 400,
    approvedCount: 22,
    rejectedCount: 10,
    trustScore: 60,
    createdAt: createdDaysAgo(60)
  }, NOW);
  assert.notEqual(notTrusted.code, 'TRUSTED_CONTRIBUTOR');

  const trusted = calculateReputation({
    qualityPoints: 420,
    approvedCount: 28,
    rejectedCount: 4,
    trustScore: 78,
    createdAt: createdDaysAgo(90)
  }, NOW);
  assert.equal(trusted.code, 'TRUSTED_CONTRIBUTOR');
});

test('local expert cannot be reached by quality points alone', () => {
  const almost = calculateReputation({
    qualityPoints: 2000,
    approvedCount: 70,
    rejectedCount: 15,
    trustScore: 79,
    createdAt: createdDaysAgo(200)
  }, NOW);
  assert.notEqual(almost.code, 'LOCAL_EXPERT');

  const expert = calculateReputation({
    qualityPoints: 900,
    approvedCount: 80,
    rejectedCount: 8,
    trustScore: 90,
    createdAt: createdDaysAgo(200)
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
    createdAt: createdDaysAgo(9999)
  }, NOW);
  assert.equal(reputation.score, 100);
});
