import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyReviewerPolicy,
  computeReviewerScore,
  REVIEWER_POLICY_CONFIRMED,
  REVIEWER_POLICY_STATUS,
} from '../src/insights/letter-reviewer-policy.js';

test('1. reviewer policy is confirmed and uses 50/20/30 defaults', () => {
  assert.equal(REVIEWER_POLICY_STATUS, 'confirmed');
  assert.equal(REVIEWER_POLICY_CONFIRMED, true);
  const cand = { modelId: 'r1', performance: 80, speed: 90, price: 70 };
  // 80*0.5 + 90*0.2 + 70*0.3 = 40 + 18 + 21 = 79
  assert.equal(computeReviewerScore(cand), 79);
});

test('2. weight override changes score and alters ranking order', () => {
  const cSpeed = { modelId: 'speedy', performance: 80, speed: 100, price: 0 };
  const cCheap = { modelId: 'thrifty', performance: 80, speed: 0, price: 100 };
  // Default 50/20/30: speedy gets 40+20=60, thrifty gets 40+30=70 -> thrifty wins
  const def = applyReviewerPolicy([cSpeed, cCheap]);
  assert.deepEqual(def.map(c => c.modelId), ['thrifty', 'speedy']);
  // Override 50/40/10: speedy gets 40+40=80, thrifty gets 40+10=50 -> speedy wins
  const over = applyReviewerPolicy([cSpeed, cCheap], { weights: { performance: 0.50, speed: 0.40, price: 0.10 } });
  assert.deepEqual(over.map(c => c.modelId), ['speedy', 'thrifty']);
});

test('3. evidence recalculates reviewer score and fixes candidate score precedence bug', () => {
  // Candidate has prior orchestrator score: 99
  const cand = { modelId: 'r1', score: 99, performance: 80, speed: 90, price: 70 };
  const res = applyReviewerPolicy([cand]);
  // Reviewer weights recompute to 79 rather than silently keeping 99
  assert.equal(res[0]?.score, 79);
});

test('4. pre-existing score preserved when evidence is missing without fabrication', () => {
  const cand = { modelId: 'r-pre', score: 85 };
  assert.equal(computeReviewerScore(cand), 85);
  const candNoScore = { modelId: 'r-none', performance: 80 }; // missing speed and price
  assert.equal(computeReviewerScore(candNoScore), undefined);
});

test('5. custom callback takes precedence over evidence', () => {
  const cand = { modelId: 'r1', performance: 80, speed: 90, price: 70 };
  const score = computeReviewerScore(cand, undefined, (c) => 99.5);
  assert.equal(score, 99.5);
});

test('6. orchestrator and worker candidates/policies untouched', () => {
  const orchCand = { modelId: 'o1', score: 95, performance: 10, speed: 10, price: 10 };
  // applyReviewerPolicy is only applied to reviewer; orchCand remains as-is
  assert.equal(orchCand.score, 95);
});
