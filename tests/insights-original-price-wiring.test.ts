import assert from 'node:assert/strict';
import test from 'node:test';
import { runInsights } from '../src/composition/insights.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { buildAaTop10Inputs } from '../src/insights/letter-top10-history.js';
import { top10OptionsFrom } from '../src/insights/letter-top10-render-options.js';
import { buildPreviousCognitionTop10Records } from '../src/insights/cognition-top10.js';
import { DEFAULT_REQUEST_SCOPES, DEFAULT_SCHEMA_VERSIONS } from '../src/insights/run-once-steps.js';
import type { InsightRecord, InsightSource } from '../src/insights/record.js';
import type { ProcessRunner } from '../src/infra/process-port.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';
import { validateInsightRows } from '../src/insights/validation.js';

const NOW = '2026-10-14T12:00:00.000Z', TODAY = '2026-10-14', YESTERDAY = '2026-10-13';
const rec = (source: InsightSource, modelId: string, metric: string, value: number): InsightRecord => ({
  source, modelId, metric, value, unit: metric.startsWith('price_') ? 'USD/1M tokens' : 'score', category: 'fixture', observedAt: NOW,
  sourceAsOf: TODAY, sourceUrl: source === 'cognition' ? 'https://cognition.com' : 'https://artificialanalysis.ai',
  sourceName: source, license: null, attributionText: 'fixture', method: 'fixture', schemaVersion: DEFAULT_SCHEMA_VERSIONS[source],
  ...(source === 'cognition' && { metadata: { subset: 'main', effort: 'high' } }),
});
const valid = (source: InsightSource, records: readonly InsightRecord[], date: string) => {
  const checked = validateInsightRows(source, [{ ok: true, index: 0, records: records.map(row => ({ ...row, sourceAsOf: date,
    observedAt: `${date}T12:00:00.000Z`, ...(source !== 'cognition' && { metadata: { date } }) })), warnings: [] }]);
  assert.ok(checked.ok); return checked;
};
const port = (source: InsightSource, records: readonly InsightRecord[]): InsightSourcePort => ({ id: source, fetch: async () => null,
  parse: () => [{ ok: true, index: 0, records, warnings: [] }] });

test('current and prior inputs preserve AA/Cognition original prices and keep Free as access metadata', async () => {
  const aaRows = [rec('artificial-analysis', 'gpt-6-1-sol', 'artificial_analysis_intelligence_index', 80),
    rec('artificial-analysis', 'gpt-6-1-sol', 'price_1m_input_tokens', 0), rec('artificial-analysis', 'gpt-6-1-sol', 'price_1m_output_tokens', 2),
    rec('artificial-analysis', 'claude-haiku-5-5', 'artificial_analysis_coding_index', 70),
    rec('artificial-analysis', 'step-5', 'price_1m_input_tokens', 0.2), rec('artificial-analysis', 'step-5', 'price_1m_output_tokens', 0.5),
    rec('artificial-analysis', 'gpt-5-4-pro', 'price_1m_input_tokens', 3), rec('artificial-analysis', 'gpt-5-4-pro', 'price_1m_output_tokens', 9)];
  const cogRows = [rec('cognition', 'GPT-6 Luna', 'cost', 0), rec('cognition', 'Claude Haiku 5.5', 'correct', 0.6)];
  const history = new MemoryInsightHistory();
  for (const [source, rows] of [['artificial-analysis', aaRows], ['cognition', cogRows]] as const) {
    const prior = valid(source, rows, YESTERDAY);
    assert.equal(history.saveDaily({ source, publicationDate: YESTERDAY, requestScope: DEFAULT_REQUEST_SCOPES[source],
      schemaVersion: DEFAULT_SCHEMA_VERSIONS[source] }, prior), true);
  }
  const runner: ProcessRunner = { run: async () => ({ stdout: 'opencode/step-5-free', stderr: '', exitCode: 0 }) };
  const result = await runInsights({ env: {}, dataEnv: {}, clock: () => Date.parse(NOW), createPorts: () => [port('artificial-analysis', aaRows), port('cognition', cogRows)],
    processRunner: runner, openHistory: () => Object.assign(history, { close: () => {} }) });
  const records = result.top10!.records;
  assert.deepEqual(records.find(row => row.modelId === 'gpt-6-1-sol' && row.metric === 'artificial_analysis_intelligence_index') &&
    [records.find(row => row.modelId === 'gpt-6-1-sol' && row.metric === 'artificial_analysis_intelligence_index')!.priceInput,
      records.find(row => row.modelId === 'gpt-6-1-sol' && row.metric === 'artificial_analysis_intelligence_index')!.priceOutput], [0, 2]);
  assert.deepEqual(records.filter(row => row.modelId === 'gpt-5-4-pro').map(row => [row.metric, row.priceInput, row.priceOutput]),
    [['price_1m_input_tokens', 3, 9]]);
  assert.deepEqual(records.filter(row => row.modelId === 'step-5').map(row => [row.metric, row.priceInput, row.priceOutput]),
    [['price_1m_input_tokens', 0.2, 0.5]]);
  const missing = records.find(row => row.modelId === 'claude-haiku-5-5')!;
  assert.equal(missing.priceInput, undefined); assert.equal(missing.priceOutput, undefined);
  const priorAA = buildAaTop10Inputs(valid('artificial-analysis', aaRows, YESTERDAY).records);
  assert.deepEqual(priorAA.find(row => row.modelId === 'gpt-6-1-sol') && [priorAA.find(row => row.modelId === 'gpt-6-1-sol')!.priceInput,
    priorAA.find(row => row.modelId === 'gpt-6-1-sol')!.priceOutput], [0, 2]);
  assert.deepEqual(buildPreviousCognitionTop10Records(history, TODAY, DEFAULT_REQUEST_SCOPES.cognition,
    DEFAULT_SCHEMA_VERSIONS.cognition).find(row => row.modelId === 'gpt-6-luna-high'),
  { modelId: 'gpt-6-luna-high', metric: 'cognition_cost', value: 0 });
  const free = result.top10!.freeCatalog!;
  assert.ok(free.flatMap(plan => plan.models).every(model => !('priceInput' in model) && !('priceOutput' in model)));
  assert.deepEqual(top10OptionsFrom({ freeCatalog: free }).freeCatalog, free);
});
