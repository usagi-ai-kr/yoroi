import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeAaPages } from '../src/insights/aa-pages.js';
import { parseAaPages } from '../src/insights/sources-aa.js';
import { validateInsightRows } from '../src/insights/validation.js';

const AT = '2026-10-13T00:00:00.000Z';
const model = (slug: string, coding: number) => ({ id: `id-${slug}`, slug, name: slug, release_date: null,
  model_creator: { id: 'c', name: 'C' }, evaluations: { artificial_analysis_coding_index: coding },
  pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 }, performance: { median_output_tokens_per_second: 40 } });
const badRow = { id: 'x', slug: 123, name: 'X', model_creator: { id: 'c', name: 'C' },
  evaluations: {}, pricing: {}, performance: {} };
const page = (n: number, data: readonly unknown[]) => ({ tier: 'free', intelligence_index_version: 4,
  pagination: { page: n, page_size: 200, total_pages: 2, has_more: n < 2 }, data });
const pages = [{ page: 1, payload: page(1, [model('a', 90), badRow, model('b', 80)]) },
  { page: 2, payload: page(2, [model('c', 70), badRow, model('d', 60)]) }];

test('2페이지 중 2행 거절: merge가 수와 원본 행을 보존한다', () => {
  const merged = mergeAaPages(pages, { observedAt: AT });
  assert.equal(merged.status, 'ok');
  assert.deepEqual([merged.rejectedRows, merged.rejected.length, merged.rejected.every(r => !r.ok)], [2, 2, true]);
  assert.ok(merged.records.length > 0);
});

test('parseAaPages가 거절 행을 ok:false로 함께 반환하고 유효 records는 유지한다', () => {
  const rows = parseAaPages(pages, AT, {});
  const ok = rows.filter(r => r.ok), rejected = rows.filter(r => !r.ok);
  assert.deepEqual([ok.length, rejected.length], [4, 2]);
  assert.deepEqual([...new Set(ok.flatMap(r => r.records.map(x => x.modelId)))].sort(), ['a', 'b', 'c', 'd']);
  assert.ok(rejected.every(r => !r.ok && r.reason.includes('invalid-row')));
});

test('거절 행 2개가 validation rejectedRows=2(partial, complete=false)로 이어진다', () => {
  const validation = validateInsightRows('artificial-analysis', parseAaPages(pages, AT, {}));
  assert.ok(validation.ok);
  assert.equal(validation.rejectedRows, 2);
  assert.equal(validation.rejectedRows > 0, true); // runSource: partial = rejectedRows>0 → complete=false 저장 판정
});

test('거절 행이 없으면 rejectedRows=0으로 기존 저장 판정이 유지된다', () => {
  const clean = [{ page: 1, payload: page(1, [model('a', 90), model('b', 80)]) },
    { page: 2, payload: page(2, [model('c', 70)]) }];
  const validation = validateInsightRows('artificial-analysis', parseAaPages(clean, AT, {}));
  assert.ok(validation.ok);
  assert.equal(validation.rejectedRows, 0);
  assert.equal(mergeAaPages(clean, { observedAt: AT }).rejectedRows, 0);
});

const rejectOf = (row: unknown) => {
  const rows = parseAaPages([{ page: 1, payload: page(1, [model('ok', 90), row]) }], AT, {});
  const rejected = rows.filter(r => !r.ok);
  assert.equal(rejected.length, 1);
  return rejected[0] as { readonly rejectCode?: unknown; readonly rejectFields?: unknown };
};

test('거절 사유는 코드·필드명으로 분류되고 원문 값은 싣지 않는다', () => {
  assert.deepEqual([rejectOf(badRow).rejectCode, rejectOf(badRow).rejectFields], ['missing-id', ['slug']]);
  const noCreator = { ...model('x', 10), model_creator: { id: 'c' } };
  assert.deepEqual([rejectOf(noCreator).rejectCode, rejectOf(noCreator).rejectFields],
    ['missing-creator', ['model_creator.name']]);
  const badDate = { ...model('x', 10), release_date: 'yesterday' };
  assert.deepEqual([rejectOf(badDate).rejectCode, rejectOf(badDate).rejectFields], ['bad-date', ['release_date']]);
  const badGroup = { ...model('x', 10), pricing: 'nope' };
  assert.deepEqual([rejectOf(badGroup).rejectCode, rejectOf(badGroup).rejectFields], ['bad-group', ['pricing']]);
  const badNumber = { ...model('x', 10),
    pricing: { price_1m_input_tokens: 'expensive', price_1m_output_tokens: 2 } };
  assert.deepEqual([rejectOf(badNumber).rejectCode, rejectOf(badNumber).rejectFields],
    ['bad-number', ['price_1m_input_tokens']]);
  const dumped = JSON.stringify([rejectOf(badRow), rejectOf(noCreator), rejectOf(badDate),
    rejectOf(badGroup), rejectOf(badNumber)]);
  for (const secret of ['123', 'expensive', 'yesterday', '\"x\"']) assert.ok(!dumped.includes(secret));
});

test('거절 집계는 사유·필드별 건수만 노출하고 판정 수와 일치한다', () => {
  const validation = validateInsightRows('artificial-analysis', parseAaPages(pages, AT, {}));
  if (!validation.ok) assert.fail('ok expected');
  assert.deepEqual([validation.rejectedReasons, validation.rejectedFields],
    [{ 'missing-id': 2 }, { slug: 2 }]);
  assert.equal(Object.values(validation.rejectedReasons ?? {}).reduce((a, b) => a + b, 0), validation.rejectedRows);
  const dumped = JSON.stringify({ codes: validation.rejectedReasons, fields: validation.rejectedFields });
  assert.ok(!dumped.includes('\"a\"') && !dumped.includes('\"b\"'));
});

test('no-measurement·원천 cost 필드 경로를 코드로 분류한다', () => {
  const empty = { id: 'i', slug: 's', name: 'n', release_date: null, model_creator: { id: 'c', name: 'C' }, evaluations: {}, pricing: {}, performance: {} };
  assert.deepEqual([rejectOf(empty).rejectCode, rejectOf(empty).rejectFields], ['no-measurement', []]);
  const costNum = { ...model('x', 10), artificial_analysis_intelligence_index_cost: 7 };
  assert.deepEqual([rejectOf(costNum).rejectCode, rejectOf(costNum).rejectFields], ['bad-number', ['artificial_analysis_intelligence_index_cost']]);
});

test('목록 밖 코드·필드는 other·제거되고 무거절 결과엔 필드가 없다', () => {
  const evil = [{ ok: false as const, index: 9, reason: 'x', warnings: [], rejectCode: 'sentinel-evil', rejectFields: ['token', 'slug'] }];
  const mixed = validateInsightRows('artificial-analysis', [...parseAaPages(pages, AT, {}).filter(r => r.ok), ...evil]);
  if (!mixed.ok) assert.fail('ok expected');
  assert.deepEqual([mixed.rejectedReasons, mixed.rejectedFields], [{ other: 1 }, { slug: 1 }]);
  assert.ok(!JSON.stringify([mixed.rejectedReasons, mixed.rejectedFields]).includes('sentinel'));
  const clean = validateInsightRows('artificial-analysis', parseAaPages([{ page: 1, payload: page(1, [model('a', 90)]) }], AT, {}));
  if (!clean.ok) assert.fail('ok expected');
  assert.ok(!('rejectedReasons' in clean) && !('rejectedFields' in clean));
});
