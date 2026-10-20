import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewerCandidates } from '../src/composition/insights-reviewer-candidates.js';
import { officialFreeListing, officialFreePlans } from '../src/insights/opencode-free-official.js';
import { buildCandidatePool } from '../src/insights/letter-top10-candidates.js';

const M = 'artificial_analysis_intelligence_index', TPS = 'median_output_tokens_per_second';
const IDS = ['minimax-m3-1-flash', 'deepseek-v4-1-flash', 'glm-5-3-flash', 'mimo-v2-6-flash'];
const catalog = officialFreePlans(officialFreeListing());
const records = IDS.flatMap((modelId, i) => [
  { modelId, metric: M, value: 80 - i * 3, priceInput: 1 + i, priceOutput: 2 + i },
  { modelId, metric: TPS, value: 60 + i * 10 }]);
const LISTS = { allowOlder: [], excludePatterns: [], ban: { common: [], orchestrator: [], worker: [] } };

test('alias+pool with explicit official catalog connects all four', () => {
  const pool = buildCandidatePool(records, catalog, [], LISTS);
  for (const id of IDS) assert.ok(pool.accessibleRecords.some(r => r.modelId.includes(id.split('-')[0]!)), `${id} accessible`);
});

test('helper honors top10Opts.catalog (BLOCK until fixed)', () => {
  const res = buildReviewerCandidates({ records }, { top10Options: { catalog } });
  assert.equal(res.reviewer.length, 4, 'official catalog models flow through helper');
});
