import assert from 'node:assert/strict';
import test from 'node:test';
import { isInsightRow, isInsightSource, isNormalizedBenchmarkRecord,
  type InsightProvider, type NormalizedBenchmarkRecord } from '../src/insights/types.js';
import { parseArenaRows } from '../src/insights/arena-parser.js';
import { parseAaResponse } from '../src/insights/aa-parser.js';
import { parseOpenRouterResponse } from '../src/insights/openrouter-parser.js';
import { INSIGHT_SOURCES } from '../src/insights/sources.js';
import type { InsightRecord } from '../src/insights/record.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';

const now = '2026-10-08T00:00:00Z';
const recordsOf = (rows: readonly ParseRowResult[]) =>
  rows.flatMap(row => row.ok ? row.records : []);

test('isInsightRow accepts objects and rejects every non-object JSON shape', () => {
  assert.ok(isInsightRow({}));
  assert.ok(isInsightRow({ a: 1, b: null }));
  for (const bad of [null, undefined, [], 'x', 0, true, [1, 2]]) assert.ok(!isInsightRow(bad));
});

test('isInsightSource covers exactly the registered source ids', () => {
  for (const entry of INSIGHT_SOURCES) assert.ok(isInsightSource(entry.id), entry.id);
  assert.ok(!isInsightSource('opencode'));
  assert.ok(!isInsightSource(undefined));
  assert.ok(!isInsightSource(''));
});

test('isNormalizedBenchmarkRecord requires identity, unit, and a finite value', () => {
  const base = { source: 'arena', modelId: 'm', metric: 'rating', value: 1, unit: 'score',
    category: 'c', observedAt: now, sourceAsOf: now, license: null };
  assert.ok(isNormalizedBenchmarkRecord(base));
  assert.ok(isNormalizedBenchmarkRecord({ ...base, metadata: { k: 'v' } }));
  for (const key of ['modelId', 'metric', 'unit', 'observedAt', 'sourceAsOf']) {
    const broken: Record<string, unknown> = { ...base };
    delete broken[key];
    assert.ok(!isNormalizedBenchmarkRecord(broken), `missing ${key} must be rejected`);
  }
  for (const bad of [{ ...base, value: NaN }, { ...base, value: Infinity },
    { ...base, value: '1' }, { ...base, modelId: '  ' }, { ...base, unit: '' }])
    assert.ok(!isNormalizedBenchmarkRecord(bad), JSON.stringify(bad));
  assert.ok(!isNormalizedBenchmarkRecord([base]));
});

test('every record the shipped parsers emit satisfies the normalized contract', () => {
  const arena = recordsOf(parseArenaRows([{ model_name: 'm', organization: 'o', license: 'CC-BY-4.0',
    category: 'Text', leaderboard_publish_date: '2026-01-02', rating: 1500, rating_lower: 1400,
    rating_upper: 1600, variance: 12, vote_count: 100, rank: 1 }], now));
  const aa = recordsOf(parseAaResponse({ tier: 'free', intelligence_index_version: 2.5,
    pagination: { page: 1, page_size: 20, total_pages: 1, has_more: false },
    data: [{ id: 'i', slug: 's', name: 'n', model_creator: { id: 'c', name: 'C' }, release_date: null,
      evaluations: { artificial_analysis_intelligence_index: 50 },
      pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 },
      performance: { median_output_tokens_per_second: 90 } }] }, now));
  const openrouter = recordsOf(parseOpenRouterResponse({ data: [{ date: '2026-01-02',
    model_permaslug: 'vendor/model', total_tokens: '1234' }],
    meta: { as_of: now, start_date: '2026-01-01', end_date: '2026-01-03', version: 'v1' } }, now));
  const all = [...arena, ...aa, ...openrouter];
  // Every parser must contribute, otherwise a silent parse failure would pass vacuously.
  assert.ok(arena.length > 0 && aa.length > 0 && openrouter.length > 0,
    `expected records from every parser, got ${arena.length}/${aa.length}/${openrouter.length}`);
  for (const record of all) {
    assert.ok(isNormalizedBenchmarkRecord(record), `${record.source}/${record.metric}`);
  }
});

test('InsightRecord structurally satisfies NormalizedBenchmarkRecord', () => {
  const record: InsightRecord = { source: 'openrouter', modelId: 'vendor/model',
    metric: 'total_tokens', value: 1234, unit: 'tokens', category: 'usage',
    observedAt: now, sourceAsOf: now, sourceUrl: 'https://openrouter.ai/rankings',
    sourceName: 'OpenRouter', license: 'CC-BY-4.0', attributionText: 'x',
    method: 'official-api', schemaVersion: 'openrouter-rankings-v1' };
  const normalized: NormalizedBenchmarkRecord = record;
  assert.ok(isNormalizedBenchmarkRecord(normalized));
});

test('the source catalog can be read as InsightProvider entries', () => {
  const providers: readonly InsightProvider[] = INSIGHT_SOURCES.map(entry => ({
    id: entry.id, displayName: entry.displayName, url: entry.url, license: entry.license,
    redistributable: entry.license !== null && entry.note !== 'Internal use only; redistribution prohibited' }));
  assert.equal(providers.length, INSIGHT_SOURCES.length);
  assert.ok(providers.every(provider => isInsightSource(provider.id)));
  assert.ok(providers.some(provider => !provider.redistributable), 'null license must not be redistributable');
});