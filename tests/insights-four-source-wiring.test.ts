import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import { DEFAULT_REQUEST_SCOPES, DEFAULT_SCHEMA_VERSIONS } from '../src/insights/run-once-steps.js';
import { validateInsightRecord, type ValidatedInsightRecord } from '../src/insights/validation.js';
import type { InsightRecord, InsightSource } from '../src/insights/record.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';

const AT = '2026-10-13T00:30:00.000Z', CUR = '2026-10-12', PREV = '2026-10-11';
const metrics = { 'artificial-analysis': ['artificial_analysis_intelligence_index', 'artificial_analysis_coding_index'],
  openrouter: ['total_tokens'], cognition: ['correct'], 'opencode-data': ['opencode_data_tokens'] } as const;
const unit = (s: InsightSource) => s === 'cognition' ? 'ratio' : s === 'openrouter' || s === 'opencode-data' ? 'tokens' : 'score';
const url = (s: InsightSource) => s === 'cognition' ? 'https://cognition.com' : s === 'openrouter' ? 'https://openrouter.ai' :
  s === 'opencode-data' ? 'https://opencode.ai' : 'https://artificialanalysis.ai';
function row(source: InsightSource, metric: string, date: string, schemaVersion = DEFAULT_SCHEMA_VERSIONS[source]): ValidatedInsightRecord {
  const record: InsightRecord = { source, modelId: 'claude-haiku-5-5', metric, value: 0.6, unit: unit(source), category: 'main',
    observedAt: AT, sourceAsOf: date, sourceUrl: url(source), sourceName: source, license: null, attributionText: 'fixture',
    method: 'official-api', schemaVersion, metadata: { date, subset: 'main', effort: 'high' } };
  const checked = validateInsightRecord(record); assert.equal(checked.ok, true);
  if (!checked.ok) throw new Error('fixture rejected');
  return checked.value;
}
const port = (source: InsightSource): InsightSourcePort => ({ id: source, fetch: async () => null,
  parse: () => [{ ok: true, index: 0, records: metrics[source].map(metric => row(source, metric, CUR).record), warnings: [] }] });
function savePrior(history: MemoryInsightHistory, source: InsightSource, schemaVersion = DEFAULT_SCHEMA_VERSIONS[source]): void {
  const rows = metrics[source].map(metric => row(source, metric, PREV, schemaVersion));
  assert.equal(history.saveDaily({ source, publicationDate: '2026-10-12', requestScope: DEFAULT_REQUEST_SCOPES[source], schemaVersion },
    { ok: true, source, records: rows, rejectedRows: 0 }), true);
}
const ports = (omit?: InsightSource) => (Object.keys(metrics) as InsightSource[]).filter(source => source !== omit).map(port);

test('current and prior snapshots wire AA, OpenRouter, Cognition and OpenCode Data without gaps', async () => {
  const history = new MemoryInsightHistory();
  for (const source of Object.keys(metrics) as InsightSource[]) savePrior(history, source);
  const run = await runInsightsOnce({ ports: ports(), history, now: () => AT });
  assert.equal(run.top10?.records.length, 2);
  assert.equal(run.top10?.openrouterRecords.length, 1);
  assert.equal(run.top10?.cognitionRecords?.length, 1);
  assert.equal(run.top10?.opencodeDataRecords?.length, 1);
  assert.deepEqual(run.top10?.warnings, undefined);
});

test('a prior source schema mismatch holds both role comparisons with a source diagnostic', async () => {
  const history = new MemoryInsightHistory();
  for (const source of Object.keys(metrics) as InsightSource[]) savePrior(history, source, source === 'openrouter' ? 'old-schema' : DEFAULT_SCHEMA_VERSIONS[source]);
  const run = await runInsightsOnce({ ports: ports(), history, now: () => AT });
  assert.deepEqual(run.top10?.previousRanks, []);
  assert.ok(run.top10?.warnings?.some(w => w.includes('OpenRouter') && w.includes('스키마 불일치')));
});

test('a missing prior OpenCode Data snapshot is detected and comparisons are held', async () => {
  const history = new MemoryInsightHistory();
  for (const source of Object.keys(metrics) as InsightSource[]) if (source !== 'opencode-data') savePrior(history, source);
  const run = await runInsightsOnce({ ports: ports(), history, now: () => AT });
  assert.deepEqual(run.top10?.previousRanks, []);
  assert.ok(run.top10?.warnings?.some(w => w.includes('OpenCode Data')));
});
