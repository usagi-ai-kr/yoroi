import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { buildPreviousRanks } from '../src/insights/letter-top10-history.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import { validateInsightRecord, type ValidatedInsightRecord } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';

const DAY = '2026-10-12', AT = `${DAY}T12:00:00Z`;
const aa = (modelId: string, metric: string, value: number, date = DAY): ValidatedInsightRecord => {
  const result = validateInsightRecord({ source: 'artificial-analysis', modelId, metric, value, unit: 'score', category: 'llm',
    observedAt: `${date}T12:00:00Z`, sourceAsOf: date, sourceUrl: 'https://artificialanalysis.ai', sourceName: 'AA', license: null,
    attributionText: 'fixture', method: 'fixture', schemaVersion: 'aa-v2-free' } as InsightRecord);
  assert.ok(result.ok); return result.value;
};
const or = (modelId: string): ValidatedInsightRecord => {
  const result = validateInsightRecord({ source: 'openrouter', modelId, metric: 'total_tokens', value: 100, unit: 'tokens', category: 'usage',
    observedAt: AT, sourceAsOf: DAY, sourceUrl: 'https://openrouter.ai', sourceName: 'OR', license: null, attributionText: 'fixture',
    method: 'fixture', schemaVersion: 'openrouter-rankings-v1', metadata: { date: DAY } } as InsightRecord);
  assert.ok(result.ok); return result.value;
};

test('price-only paired AA rows reach current and previous Top10 scoring inputs', async () => {
  const priceOnly = ['price_1m_input_tokens', 'price_1m_output_tokens'] as const;
  const currentAa = [aa('gpt-5-4-pro', priceOnly[0], 0.2), aa('gpt-5-4-pro', priceOnly[1], 0.8),
    aa('claude-haiku-5-5', priceOnly[0], 0.3), aa('claude-haiku-5-5', priceOnly[1], 1.2),
    aa('claude-haiku-5-5', 'median_output_tokens_per_second', 40)];
  const port: InsightSourcePort = { id: 'artificial-analysis', fetch: async () => null,
    parse: () => [{ ok: true, index: 0, records: currentAa.map(v => v.record), warnings: [] }] };
  const current = await runInsightsOnce({ ports: [port], history: new MemoryInsightHistory(), now: () => AT });
  assert.deepEqual(current.top10?.records.filter(r => r.modelId === 'gpt-5-4-pro'), [
    { modelId: 'gpt-5-4-pro', value: 0.2, metric: priceOnly[0], priceInput: 0.2, priceOutput: 0.8 },
  ]);
  assert.equal(current.top10?.records.filter(r => r.modelId === 'claude-haiku-5-5').length, 1);
  const history = new MemoryInsightHistory(), previousAa = [aa('gpt-6-1-sol', priceOnly[0], 0.1), aa('gpt-6-1-sol', priceOnly[1], 0.3)];
  const previousOr = [or('gpt-6-1-sol'), or('claude-haiku-5-5')];
  assert.equal(history.saveDaily({ source: 'openrouter', publicationDate: DAY, requestScope: 'rankings-daily:day:top50',
    schemaVersion: 'openrouter-rankings-v1' }, { ok: true, source: 'openrouter', rejectedRows: 0, records: previousOr }), true);
  const ranks = buildPreviousRanks(history, '2026-10-13', { ok: true, source: 'artificial-analysis', rejectedRows: 0, records: previousAa },
    'rankings-daily:day:top50', 'openrouter-rankings-v1', true);
  assert.equal(ranks.ranks.find(r => r.metric === 'orchestrator' && r.modelId === 'gpt-6-1-sol')?.rank, 1,
    'Haiku는 1.2.1 오케 밴으로 제외되어 price-only AA fallback이 1위');
});
