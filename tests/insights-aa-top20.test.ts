import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import { parseAaPages, selectAaTopModels } from '../src/insights/sources-aa.js';

const AT = '2026-10-12T00:00:00.000Z';
const model = (slug: string, coding: number | null, intel = 50) => ({
  id: `id-${slug}`, slug, name: `Model ${slug}`, release_date: null,
  model_creator: { id: 'c1', name: 'Creator' },
  evaluations: {
    ...(coding !== null ? { artificial_analysis_coding_index: coding } : {}),
    artificial_analysis_intelligence_index: intel,
  },
  pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 },
  performance: { median_output_tokens_per_second: 40 },
});
const page = (n: number, rows: ReturnType<typeof model>[], total = 1) => ({
  tier: 'free', intelligence_index_version: 4, data: rows,
  pagination: { page: n, page_size: 50, total_pages: total, has_more: n < total },
});

test('top 20 selection: 25 models (100~76) keeps top 20 (100~81) and drops 5 (80~76)', () => {
  const models = Array.from({ length: 25 }, (_, i) => model(`m-${100 - i}`, 100 - i));
  const parsed = parseAaPages([{ page: 1, payload: page(1, models) }], AT, {});
  assert.equal(parsed.length, 20);
  const slugs = parsed.map(p => p.ok ? p.records[0]!.modelId : '');
  const expected = Array.from({ length: 20 }, (_, i) => `m-${100 - i}`);
  assert.deepEqual(slugs, expected);
  for (let s = 80; s >= 76; s -= 1) assert.ok(!slugs.includes(`m-${s}`));
});

test('top 20 ties: 19 at 100~82, 3 at 81 yields all 22 models and drops lower', () => {
  const top19 = Array.from({ length: 19 }, (_, i) => model(`m-${100 - i}`, 100 - i));
  const ties3 = ['tie-a', 'tie-b', 'tie-c'].map(s => model(s, 81));
  const lower = [model('low-80', 80), model('low-75', 75)];
  const parsed = parseAaPages([{ page: 1, payload: page(1, [...top19, ...ties3, ...lower]) }], AT, {});
  assert.equal(parsed.length, 22);
  const slugs = parsed.map(p => p.ok ? p.records[0]!.modelId : '');
  for (const s of ['tie-a', 'tie-b', 'tie-c']) assert.ok(slugs.includes(s));
  assert.ok(!slugs.includes('low-80') && !slugs.includes('low-75'));
});

test('models with null/missing coding_index are excluded from ranking and output', () => {
  const withScore = [model('valid-1', 95), model('valid-2', 85)];
  const withoutScore = [model('no-coding-null', null, 99), model('no-coding-undef', null, 70)];
  const parsed = parseAaPages([{ page: 1, payload: page(1, [...withScore, ...withoutScore]) }], AT, {});
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed.map(p => p.ok ? p.records[0]!.modelId : '').sort(), ['valid-1', 'valid-2']);
});

test('selected models preserve other metrics including intelligence_index, pricing and performance', () => {
  const parsed = parseAaPages([{ page: 1, payload: page(1, [model('full-model', 90, 88)]) }], AT, {});
  assert.equal(parsed.length, 1);
  const row0 = parsed[0]!;
  assert.ok(row0.ok);
  const metrics = row0.records.map(r => r.metric);
  for (const m of ['artificial_analysis_coding_index', 'artificial_analysis_intelligence_index',
    'price_1m_input_tokens', 'price_1m_output_tokens', 'median_output_tokens_per_second']) {
    assert.ok(metrics.includes(m), `missing metric ${m}`);
  }
  assert.equal(row0.records.find(r => r.metric === 'artificial_analysis_coding_index')?.value, 90);
  assert.equal(row0.records.find(r => r.metric === 'artificial_analysis_intelligence_index')?.value, 88);
});

test('incomplete 4-page fetch throws unavailable SourceError preserving completeness rule', () => {
  const mkPage = (n: number) => page(n, [model(`m-p${n}`, 90 - n)], 4);
  const failurePages = [
    { page: 1, payload: mkPage(1) }, { page: 2, payload: mkPage(2) },
    { page: 3, failure: 'Synthetic 500 error' }, { page: 4, payload: mkPage(4) },
  ];
  assert.throws(() => parseAaPages(failurePages, AT, {}), (e: unknown) =>
    e instanceof SourceError && e.code === 'unavailable');
  const duplicatePages = [{ page: 1, payload: mkPage(1) }, { page: 2, payload: mkPage(1) }];
  assert.throws(() => parseAaPages(duplicatePages, AT, {}), (e: unknown) =>
    e instanceof SourceError && e.code === 'unavailable');
});

test('selectAaTopModels handles empty array and fewer than limit models', () => {
  assert.deepEqual(selectAaTopModels([]), []);
  const parsed = parseAaPages([{ page: 1, payload: page(1, [model('solo', 50)]) }], AT, {});
  assert.equal(parsed.length, 1);
});
