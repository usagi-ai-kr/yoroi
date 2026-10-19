import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { parseAaResponse } from '../src/insights/aa-parser.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';

const rows = [
  ['muse-spark-1-3-xhigh', 40], ['muse-spark-1-3-max', 41], ['claude-opus-5-5', 40.5],
].map(([slug, value]) => ({ id: slug, slug, name: slug, release_date: null,
  model_creator: { id: 'test', name: 'Test' }, evaluations: { artificial_analysis_intelligence_index: value }, pricing: {}, performance: {} }));
const payload = { tier: 'free', intelligence_index_version: 3,
  pagination: { page: 1, page_size: 3, total_pages: 1, has_more: false }, data: rows };

test('run-once previousRanks uses the active effort snapshot with a stored prior AA cohort (#188)', async () => {
  const previous = process.env.YOROI_EFFORT_PROFILE;
  let observedAt = '2026-10-07T00:30:00.000Z';
  const history = new MemoryInsightHistory();
  const port: InsightSourcePort = { id: 'artificial-analysis', parse: parseAaResponse, fetch: async () => payload };
  const deps = { ports: [port], history, now: () => observedAt };
  try {
    delete process.env.YOROI_EFFORT_PROFILE;
    await runInsightsOnce(deps);
    observedAt = '2026-10-08T00:30:00.000Z';
    process.env.YOROI_EFFORT_PROFILE = 'observed-2026-10-19';
    const run = await runInsightsOnce(deps);
    assert.equal(run.top10?.effortAvailability?.activeProfile, 'observed-2026-10-19');
    assert.deepEqual(run.top10?.previousRanks.filter(row => row.metric === 'orchestrator'), [
      { modelId: 'claude-opus-5-5', rank: 1, metric: 'orchestrator' },
      { modelId: 'muse-spark-1-3', rank: 2, metric: 'orchestrator' },
    ]);
  } finally { if (previous === undefined) delete process.env.YOROI_EFFORT_PROFILE; else process.env.YOROI_EFFORT_PROFILE = previous; }
});
