import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewerCandidates } from '../src/composition/insights-reviewer-candidates.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

const M = 'artificial_analysis_intelligence_index';
const row = (id: string, intel: number, spd: number, pIn: number, pOut: number): Top10RecordInput[] => [
  { modelId: id, metric: M, value: intel, priceInput: pIn, priceOutput: pOut },
  { modelId: id, metric: 'median_output_tokens_per_second', value: spd },
];

test('dated deepseek snapshot merges into the base canonical row', () => {
  const records = [...row('deepseek-v4-1-flash-1017', 99, 60, 2, 4), ...row('deepseek-v4-1-flash', 80, 60, 2, 4)];
  const res = buildReviewerCandidates({ records });
  const ds = res.reviewer.filter(r => r.baseModelId === 'deepseek-v4-1-flash');
  assert.equal(ds.length, 1, '1017 and base collapse to one reviewer row');
  assert.ok(!res.reviewer.some(r => r.modelId.includes('1017')), 'dated suffix is not exposed');
});
