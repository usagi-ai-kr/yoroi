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
