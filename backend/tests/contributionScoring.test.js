import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRIBUTION_MAX_POINTS,
  evaluateContributionScore
} from '../src/services/contributionScoring.service.js';

test('contribution scoring reaches exactly the 20 point cap', () => {
  const result = evaluateContributionScore({
    placeValue: 4,
    accuracy: 5,
    freshness: 4,
    visualCoverage: 4,
    completeness: 3
  });

  assert.equal(CONTRIBUTION_MAX_POINTS, 20);
  assert.equal(result.total, 20);
  assert.equal(result.maxPoints, 20);
});

test('contribution scoring supports partial quality awards', () => {
  const result = evaluateContributionScore({
    placeValue: 3,
    accuracy: 4,
    freshness: 2,
    visualCoverage: 3,
    completeness: 2
  });
  assert.equal(result.total, 14);
});

test('contribution scoring rejects a criterion above its maximum', () => {
  assert.throws(() => evaluateContributionScore({
    placeValue: 5,
    accuracy: 5,
    freshness: 4,
    visualCoverage: 4,
    completeness: 3
  }), /0-4 điểm/);
});

test('contribution scoring requires all criteria before approval', () => {
  assert.throws(() => evaluateContributionScore({
    placeValue: 4,
    accuracy: 5
  }), /phải nằm trong khoảng/);
});
