import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewerCandidates } from '../src/composition/insights-reviewer-candidates.js';
import { buildThreeRole } from '../src/composition/insights-three-role.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

const M = 'artificial_analysis_intelligence_index';
const row = (id: string, intel: number, spd?: number, pIn?: number, pOut?: number): Top10RecordInput[] => [
  { modelId: id, metric: M, value: intel, ...(pIn !== undefined && { priceInput: pIn }), ...(pOut !== undefined && { priceOutput: pOut }) },
  ...(spd !== undefined ? [{ modelId: id, metric: 'median_output_tokens_per_second', value: spd }] : []),
];

test('1. returns empty lists and emptyCause when input records are empty', () => {
  const res = buildReviewerCandidates({ records: [] });
  assert.equal(res.variants.length, 0); assert.equal(res.reviewer.length, 0);
  assert.ok(res.emptyCause && res.emptyCause.length > 0);
  assert.deepEqual(res.weights, { performance: 0.5, speed: 0.2, price: 0.3 });
});

test('2. full-pool (>15 variants) is preserved without top10 truncation', () => {
  const records = Array.from({ length: 20 }, (_, i) => row(`vendor/m${i}`, 60 + i, 50 + (i % 10) * 5, 2 + (i % 3), 4 + (i % 3))).flat();
  const res = buildReviewerCandidates({ records });
  assert.equal(res.variants.length, 20); assert.equal(res.candidates.length, 20); assert.equal(res.reviewer.length, 20);
  assert.ok(res.reviewer.every(r => typeof r.score === 'number' && Number.isFinite(r.score)));
});

test('3. integration: weight override flips reviewer ranking across perf, price, and speed', () => {
  const records = [...row('v/b', 98, 40, 20, 40), ...row('v/c', 75, 50, 0.5, 1.5), ...row('v/s', 80, 150, 5, 10)];
  const p = buildReviewerCandidates({ records }, { weights: { performance: 0.8, speed: 0.1, price: 0.1 } });
  const c = buildReviewerCandidates({ records }, { weights: { performance: 0.1, speed: 0.1, price: 0.8 } });
  const s = buildReviewerCandidates({ records }, { weights: { performance: 0.1, speed: 0.8, price: 0.1 } });
  assert.equal(p.reviewer[0]!.modelId, 'v/b'); assert.equal(c.reviewer[0]!.modelId, 'v/c'); assert.equal(s.reviewer[0]!.modelId, 'v/s');
});

test('4. missing dimensions are excluded with reasons, never fabricated or passed through', () => {
  const records = [...row('v/f', 85, 90, 2, 4), { modelId: 'v/ns', metric: M, value: 80, priceInput: 2, priceOutput: 4 }, { modelId: 'v/np', metric: M, value: 80 }];
  const res = buildReviewerCandidates({ records });
  assert.equal(res.candidates.length, 1); assert.equal(res.reviewer[0]!.modelId, 'v/f'); assert.equal(res.excluded.length, 2);
  assert.ok(res.excluded.some(e => e.reason.includes('speed')) && res.excluded.some(e => e.reason.includes('price')));
});

test('5. buildThreeRole integrates reviewer full-pool, config override, and emptyCause', () => {
  const records = [...row('v/top', 100, 50, 10, 20), ...row('v/b', 90, 40, 20, 40), ...row('v/c', 75, 50, 0.5, 1.5)];
  const mockRun = { exitCode: 0 as const, publicationDate: '2026-10-20', letter: { ok: true as const, sections: [] }, sources: [], pruned: 0,
    top10: { records, openrouterRecords: [], failedSources: [], previousRanks: [] } };
  const def = buildThreeRole(true, mockRun);
  const perfFirst = buildThreeRole({ options: { reviewerPolicy: { weights: { performance: 0.8, speed: 0.1, price: 0.1 } } } }, mockRun);
  assert.equal(def?.selection?.top15.reviewer[0]?.modelId, 'v/c');
  assert.equal(perfFirst?.selection?.top15.reviewer[0]?.modelId, 'v/b');
  assert.equal(def?.selection?.top15.orchestrator[0]?.modelId, 'v/top');
  assert.equal(perfFirst?.selection?.top15.orchestrator[0]?.modelId, 'v/top');

  // Missing evidence: empty reviewer + emptyCause + excluded; no fallback to orchestrator score
  const emptyRun = { exitCode: 0 as const, publicationDate: '2026-10-20', letter: { ok: true as const, sections: [] }, sources: [], pruned: 0,
    top10: { records: [{ modelId: 'm1', metric: M, value: 90 }], openrouterRecords: [], failedSources: [], previousRanks: [] } };
  const emptyOut = buildThreeRole(true, emptyRun);
  assert.equal(emptyOut?.selection?.top15.reviewer.length, 0);
  assert.ok(emptyOut?.emptyCause && emptyOut.emptyCause.length > 0);
  assert.equal(emptyOut?.excluded?.length, 1);
});
