import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import type { InsightRecord } from '../src/insights/record.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';

const observedAt = '2026-10-13T09:00:00Z';
const row = (metric: string, value: number): InsightRecord => ({ source: 'artificial-analysis', modelId: 'gpt-6-1-sol',
  modelAlias: 'GPT-6.1 Sol (Max)', metric, value, unit: 'score', category: 'language-models', observedAt,
  sourceAsOf: '2026-10-13', sourceUrl: 'https://artificialanalysis.ai', sourceName: 'Artificial Analysis',
  license: null, attributionText: 'Artificial Analysis', method: 'official-api', schemaVersion: 'aa-v2-free' });

test('run-once passes AA modelAlias and cost-per-task rows into Top10 inputs', async () => {
  const port: InsightSourcePort = { id: 'artificial-analysis', fetch: async () => null,
    parse: () => [{ ok: true, index: 0, records: [row('artificial_analysis_intelligence_index', 51.8),
      row('intelligence_index_cost_per_task', 0.7242)], warnings: [] }] };
  const result = await runInsightsOnce({ ports: [port], history: new MemoryInsightHistory(), now: () => observedAt });
  assert.ok(result.top10?.records.some(r => r.metric === 'artificial_analysis_intelligence_index' && r.modelAlias === 'GPT-6.1 Sol (Max)'));
  assert.ok(result.top10?.records.some(r => r.metric === 'intelligence_index_cost_per_task'));
});
