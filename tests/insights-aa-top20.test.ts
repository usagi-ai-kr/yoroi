import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import { parseAaPages, selectAaTopModels } from '../src/insights/sources-aa.js';
import type { InsightRecord } from '../src/insights/record.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';

const AT = '2026-10-12T00:00:00.000Z';
const model = (slug: string, coding: number | null, intel: number | null = 50) => ({
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
const recordsOf = (parsed: readonly ParseRowResult[]): InsightRecord[] =>
  parsed.flatMap(row => (row.ok ? row.records : []));

test('저장: 선택 컷 없이 25개 전부 모델별 rows로 유지한다', () => {
  const models = Array.from({ length: 25 }, (_, i) => model(`m-${100 - i}`, 100 - i));
  const parsed = parseAaPages([{ page: 1, payload: page(1, models) }], AT, {});
  assert.equal(parsed.length, 25);
  assert.deepEqual(parsed.map(p => p.ok ? p.records[0]!.modelId : ''),
    Array.from({ length: 25 }, (_, i) => `m-${100 - i}`));
});

test('저장: 하위 점수·동점 모델도 조회 컷이 없으므로 모두 유지한다', () => {
  const top19 = Array.from({ length: 19 }, (_, i) => model(`m-${100 - i}`, 100 - i));
  const ties3 = ['tie-a', 'tie-b', 'tie-c'].map(s => model(s, 81));
  const lower = [model('low-80', 80), model('low-75', 75)];
  const parsed = parseAaPages([{ page: 1, payload: page(1, [...top19, ...ties3, ...lower]) }], AT, {});
  assert.equal(parsed.length, 24);
  const slugs = parsed.map(p => p.ok ? p.records[0]!.modelId : '');
  for (const s of ['tie-a', 'tie-b', 'tie-c', 'low-80', 'low-75']) assert.ok(slugs.includes(s));
});

test('저장: coding null이라도 다른 유효 지표가 있으면 유지하고, 전 지표가 없는 행만 거절한다', () => {
  const withScore = [model('valid-1', 95), model('valid-2', 85)];
  const intelOnly = [model('intel-only-1', null, 99), model('intel-only-2', null, 70)];
  const noScore = [model('no-scores', null, null)];
  const parsed = parseAaPages([{ page: 1, payload: page(1, [...withScore, ...intelOnly, ...noScore]) }], AT, {});
  assert.deepEqual(parsed.map(p => p.ok ? p.records[0]!.modelId : '').sort(),
    ['intel-only-1', 'intel-only-2', 'no-scores', 'valid-1', 'valid-2']);
  const kept = [...new Set(selectAaTopModels(recordsOf(parsed)).map(r => r.modelId))].sort();
  assert.deepEqual(kept, ['intel-only-1', 'intel-only-2', 'valid-1', 'valid-2']); // 조회 선택기는 지수 없는 행 제외
});

test('저장 rows는 선택된 모델의 지수·단가·속도 지표를 모두 보존한다', () => {
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
  assert.deepEqual([...new Set(selectAaTopModels(recordsOf(parsed)).map(r => r.modelId))], ['solo']);
});
