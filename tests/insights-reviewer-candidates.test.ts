import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelVariant } from '../src/insights/letter-top10-group.js';
import { applyReviewerPolicy, computeReviewerScore } from '../src/insights/letter-reviewer-policy.js';
import { toReviewerCandidates } from '../src/insights/letter-reviewer-candidates.js';

const v = (modelId: string, value: number, speed?: number, cost?: number): ModelVariant => ({
  modelId, baseModelId: modelId, effort: 'default', value,
  ...(speed !== undefined && { outputTokensPerSecond: speed }),
  ...(cost !== undefined && { blendedCost: cost }),
});
const W = { performance: 0.5, speed: 0.2, price: 0.3 } as const;

test('1. cross-scale raws normalize to 0..1 per dim', () => {
  const { candidates, excluded } = toReviewerCandidates([
    v('a', 90, 50, 5), v('b', 60, 100, 10), v('c', 75, 75, 7.5)]);
  assert.equal(excluded.length, 0);
  assert.deepEqual(candidates.map(c => c.performance), [1, 0, 0.5]);
  assert.deepEqual(candidates.map(c => c.speed), [0, 1, 0.5]);
  assert.deepEqual(candidates.map(c => c.price), [1, 0, 0.5]);
});

test('2. low price outranks high raw value under 50/20/30', () => {
  const { candidates } = toReviewerCandidates([v('expy', 95, 60, 20), v('cheap', 85, 60, 2), v('anchor', 60, 60, 25)]);
  const ranked = applyReviewerPolicy(candidates, { weights: { ...W } });
  assert.equal(ranked[0]!.modelId, 'cheap');
});

test('3. weight override flips reviewer ranking', () => {
  const { candidates } = toReviewerCandidates([v('p', 100, 10, 5), v('s', 50, 100, 5)]);
  const def = applyReviewerPolicy(candidates, { weights: { ...W } });
  const spd = applyReviewerPolicy(candidates, { weights: { performance: 0.2, speed: 0.7, price: 0.1 } });
  assert.deepEqual(def.map(c => c.modelId), ['p', 's']);
  assert.deepEqual(spd.map(c => c.modelId), ['s', 'p']);
});

test('4. candidate.score never overrides the blend (regression)', () => {
  const { candidates } = toReviewerCandidates([v('x', 80, 80, 8)]);
  const withScore = [{ ...candidates[0]!, score: 99 }];
  const expected = 0.5 * candidates[0]!.performance + 0.2 * candidates[0]!.speed + 0.3 * candidates[0]!.price;
  assert.equal(computeReviewerScore(withScore[0]!, { ...W }), Number(expected.toFixed(2)));
});

test('5. missing evidence excluded, never fabricated', () => {
  const set = toReviewerCandidates([v('full', 80, 80, 8), v('nospeed', 80, undefined, 8), v('bare', 80)]);
  assert.equal(set.candidates.length, 1);
  assert.deepEqual(set.excluded.map(e => e.modelId), ['nospeed', 'bare']);
  assert.ok(set.excluded.every(e => e.missing.length > 0 && e.reason.length > 0));
  assert.ok(!set.candidates.some(c => c.performance === 0 && c.speed === 0));
});

test('6. empty pool yields empty reviewer plus cause, no throw', () => {
  const set = toReviewerCandidates([v('bare', 80)]);
  assert.deepEqual(set.candidates, []);
  assert.ok((set.emptyCause ?? '').length > 0);
});

test('7. input immutable, identity preserved, full pool usable', () => {
  const pool = Array.from({ length: 16 }, (_, i) =>
    v(`m${i}`, 50 + i, 40 + i * 2, 3 + (i % 5)));
  Object.freeze(pool);
  const { candidates } = toReviewerCandidates(pool);
  assert.equal(candidates.length, 16);
  assert.ok(candidates.every(c => c.effort === 'default'));
  assert.deepEqual(candidates.map(c => c.modelId), pool.map(p => p.modelId));
});
