import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCommunityConsensus,
  calculateVerifierWeight,
  minimumCommunityVoters
} from '../src/services/communityVerification.service.js';

test('one expert cannot create community consensus alone', () => {
  const result = calculateCommunityConsensus([
    { verdict: 'CONFIRM', weight: 1.75 }
  ], { requiredVoters: 3 });

  assert.equal(result.state, 'COLLECTING');
  assert.equal(result.confirmCount, 1);
});

test('independent agreement can confirm a standard contribution', () => {
  const result = calculateCommunityConsensus([
    { verdict: 'CONFIRM', weight: 1 },
    { verdict: 'CONFIRM', weight: 1 },
    { verdict: 'CONFIRM', weight: 1 }
  ], { requiredVoters: 3 });

  assert.equal(result.state, 'CONFIRMED');
  assert.equal(result.confirmCount, 3);
  assert.equal(result.agreementRatio, 1);
  assert.ok(result.confidence >= 90);
});

test('strong community disagreement becomes disputed', () => {
  const result = calculateCommunityConsensus([
    { verdict: 'CONFIRM', weight: 1 },
    { verdict: 'DISPUTE', weight: 1 },
    { verdict: 'DISPUTE', weight: 1 }
  ], { requiredVoters: 3 });

  assert.equal(result.state, 'DISPUTED');
  assert.equal(result.disputeCount, 2);
});

test('balanced disagreement becomes split after enough independent voters', () => {
  const result = calculateCommunityConsensus([
    { verdict: 'CONFIRM', weight: 1 },
    { verdict: 'CONFIRM', weight: 1 },
    { verdict: 'DISPUTE', weight: 1 },
    { verdict: 'DISPUTE', weight: 1 }
  ], { requiredVoters: 3 });

  assert.equal(result.state, 'SPLIT');
  assert.equal(result.agreementRatio, 0.5);
});

test('verifier weight is bounded even for high reputation expert', () => {
  const weight = calculateVerifierWeight({
    reputation: {
      code: 'LOCAL_EXPERT',
      confidence: { score: 100 }
    },
    expertise: { tier: 'EXPERT' }
  });

  assert.equal(weight, 1.75);
});

test('low confidence new member keeps a meaningful but limited vote', () => {
  const weight = calculateVerifierWeight({
    reputation: {
      code: 'NEW_MEMBER',
      confidence: { score: 10 }
    },
    expertise: { tier: 'BUILDING' }
  });

  assert.equal(weight, 0.5);
});

test('high-impact contribution types require a larger independent quorum', () => {
  assert.equal(minimumCommunityVoters('UPDATE_HOURS'), 3);
  assert.equal(minimumCommunityVoters('FIX_LOCATION'), 4);
  assert.equal(minimumCommunityVoters('REPORT_ROAD_CLOSURE'), 4);
});
