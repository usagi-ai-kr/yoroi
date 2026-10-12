import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAaPages, selectAaTopModels, AA_TOP_N } from '../src/insights/sources-aa.js';

const AT = '2026-10-12T00:00:00.000Z';
const model = (slug: string, coding: number | null, intel: number | null = 50) => ({
  id: `id-${slug}`, slug, name: `Model ${slug}`, release_date: null, model_creator: { id: 'c1', name: 'Creator' },
  evaluations: { ...(coding !== null ? { artificial_analysis_coding_index: coding } : {}),
    ...(intel !== null ? { artificial_analysis_intelligence_index: intel } : {}) },
  pricing: {}, performance: {} });
const page = (rows: ReturnType<typeof model>[], total = 1) => ({
  tier: 'free', intelligence_index_version: 4, data: rows,
  pagination: { page: 1, page_size: 200, total_pages: total, has_more: false } });
const slugs = (parsed: readonly import('../src/insights/parse-utils.js').ParseRowResult[]): string[] =>
  parsed.filter((row): row is Extract<import('../src/insights/parse-utils.js').ParseRowResult, { ok: true }> => row.ok)
    .map(row => row.records[0]!.modelId).sort();

test('top 50 by coding UNION top 50 by intelligence keeps both cohorts and their ties', () => {
  const codingTop = Array.from({ length: 50 }, (_, i) => model(`c-${String(100 - i)}`, 100 - i, 10));
  const codingTie = model('c-tie', 51, 10);
  const intelStar = model('i-star', 1, 999);
  const intelTie = model('i-tie', 0, 999);
  const below = model('below', 40, 20);
  const fillers = Array.from({ length: 50 }, (_, i) => model(`f-${i}`, 0, 100 - i));
  const parsed = parseAaPages([{ page: 1, payload: page([...codingTop, codingTie, intelStar, intelTie, below, ...fillers]) }], AT, {});
  const kept = slugs(parsed);
  assert.equal(AA_TOP_N, 50);
  for (const id of ['c-100', 'c-51', 'c-tie', 'i-star', 'i-tie']) assert.ok(kept.includes(id), id);
  assert.ok(!kept.includes('below'));
});
test('a model with neither finite score is dropped; a model with only intelligence is kept', () => {
  const onlyIntel = model('only-intel', null, 80);
  const none = model('none', null, null);
  const selected = selectAaTopModels([
    { source: 'artificial-analysis', modelId: 'only-intel', metric: 'artificial_analysis_intelligence_index', value: 80, unit: 'score', category: 'language-models', observedAt: AT, sourceAsOf: AT, sourceUrl: 'https://artificialanalysis.ai', sourceName: 'Artificial Analysis', license: null, attributionText: 'x', method: 'official-api', schemaVersion: 'aa-v2-free' },
  ]);
  assert.deepEqual(selected.map(record => record.modelId), ['only-intel']);
  const parsed = parseAaPages([{ page: 1, payload: page([onlyIntel, none]) }], AT, {});
  assert.deepEqual(slugs(parsed), ['only-intel']);
});
test('up to 50 models are all kept with every metric preserved', () => {
  const rows = Array.from({ length: 25 }, (_, i) => model(`m-${100 - i}`, 100 - i));
  const parsed = parseAaPages([{ page: 1, payload: page(rows) }], AT, {});
  assert.equal(parsed.filter(row => row.ok).length, 25);
});
