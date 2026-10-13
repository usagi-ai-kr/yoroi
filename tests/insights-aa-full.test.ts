import assert from 'node:assert/strict';
import test from 'node:test';
import { AA_FULL_REQUEST_SCOPE, parseAaPages } from '../src/insights/sources-aa.js';

const AT = '2026-10-13T00:00:00Z';
const OLD_SCOPE = 'aa-v2:free:language-models:coding-intel-value-top50';
const model = (slug: string, coding: number | null, intel: number) => ({ id: slug, slug, name: slug, release_date: null,
  model_creator: { id: 'c', name: 'C' },
  evaluations: { artificial_analysis_coding_index: coding, artificial_analysis_intelligence_index: intel },
  pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 },
  performance: { median_output_tokens_per_second: 10 } });
const page = (n: number, data: readonly unknown[], hasMore: boolean) => ({ tier: 'free', intelligence_index_version: 4,
  pagination: { page: n, page_size: 200, total_pages: 4, has_more: hasMore }, data });
const specs = Array.from({ length: 699 }, (_, i) => ({ slug: `model-${String(i).padStart(3, '0')}`,
  coding: i % 2 === 0 ? null : 10 + (i % 7), intel: 20 + (i % 40) }));
const fullPages = [0, 200, 400, 600].map((start, idx) => ({ page: idx + 1,
  payload: page(idx + 1, specs.slice(start, start + (idx < 3 ? 200 : 99)).map(s => model(s.slug, s.coding, s.intel)), idx < 3) }));

test('4페이지 699개 모델을 top50 컷 없이 모델별 rows로 모두 반환한다', () => {
  const parsed = parseAaPages(fullPages, AT, {});
  const modelIds = new Set(parsed.flatMap(r => (r.ok ? r.records : []).map(x => x.modelId)));
  assert.equal(parsed.length, 699);
  assert.equal(modelIds.size, 699);
  assert.ok(parsed.every(r => r.ok));
});

test('coding null은 레코드를 만들지 않고 0으로 채우지 않는다(다른 지표는 유지)', () => {
  const pages = [{ page: 1, payload: page(1, [model('mimo-null', null, 37.9), model('glm-ok', 74.8, 44.8)], false) }];
  const parsed = parseAaPages(pages, AT, {});
  assert.equal(parsed.length, 2);
  const records = parsed.flatMap(r => (r.ok ? r.records : []));
  const metrics = records.filter(x => x.modelId === 'mimo-null').map(x => x.metric);
  assert.deepEqual(metrics, ['artificial_analysis_intelligence_index', 'price_1m_input_tokens',
    'price_1m_output_tokens', 'median_output_tokens_per_second']);
  assert.ok(!metrics.includes('artificial_analysis_coding_index'));
  assert.equal(records.find(x => x.modelId === 'mimo-null' && x.metric === 'artificial_analysis_intelligence_index')?.value, 37.9);
  assert.ok(records.some(x => x.modelId === 'glm-ok' && x.metric === 'artificial_analysis_coding_index' && x.value === 74.8));
});

test('전체 저장 scope는 기존 top50 scope와 구분되는 새 값이다', () => {
  assert.equal(typeof AA_FULL_REQUEST_SCOPE, 'string');
  assert.notEqual(AA_FULL_REQUEST_SCOPE, OLD_SCOPE);
  assert.ok(!AA_FULL_REQUEST_SCOPE.includes('top50'));
});
