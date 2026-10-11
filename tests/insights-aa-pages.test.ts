import assert from 'node:assert/strict';
import test from 'node:test';
import { AA_MAX_PAGES, aaRecordKey, mergeAaPages, pageAllowed } from '../src/insights/aa-pages.js';
import { DEFAULT_REQUEST_POLICY } from '../src/insights/request-policy.js';

const AT = '2026-10-12T00:00:00.000Z';
const row = (slug: string) => ({ id: `id-${slug}`, slug, name: `Model ${slug}`,
  release_date: null, model_creator: { id: 'c1', name: 'Creator' },
  evaluations: { artificial_analysis_intelligence_index: 50 },
  pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 },
  performance: { median_output_tokens_per_second: 40 } });
const page = (n: number, slugs: readonly string[], total = 2) => ({ tier: 'free',
  intelligence_index_version: 4, data: slugs.map(row),
  pagination: { page: n, page_size: 50, total_pages: total, has_more: n < total } });
const merge = (pages: Parameters<typeof mergeAaPages>[0], policy = {}) =>
  mergeAaPages(pages, { observedAt: AT, policy });
/** 같은 모델·지표가 두 번 들어가지 않았는지 본다. */
const distinct = (records: readonly { modelId: string; metric: string }[]) =>
  new Set(records.map(r => `${r.modelId}|${r.metric}`)).size;
const models = (records: readonly { modelId: string }[]) => [...new Set(records.map(r => r.modelId))].sort();

test('two fake pages merge into one ordered record set', () => {
  const r = merge([{ page: 2, payload: page(2, ['beta']) }, { page: 1, payload: page(1, ['alpha']) }]);
  assert.equal(r.status, 'ok'); assert.equal(r.pagesRequested, 2); assert.equal(r.pagesSucceeded, 2);
  assert.deepEqual(r.missingPages, []); assert.equal(r.truncated, false);
  assert.deepEqual(models(r.records), ['alpha', 'beta']);
  assert.equal(r.records.length, distinct(r.records), 'no record is stored twice');
  assert.ok(r.records.every(x => x.observedAt === AT && x.source === 'artificial-analysis'));
  assert.ok(r.records.some(x => x.metric === 'artificial_analysis_intelligence_index' && x.unit === 'score'));
});

test('a model repeated across pages is stored once', () => {
  const r = merge([{ page: 1, payload: page(1, ['alpha', 'shared']) }, { page: 2, payload: page(2, ['shared', 'beta']) }]);
  const shared = r.records.filter(x => x.modelId === 'shared').map(x => `${x.metric}|${x.unit}`);
  assert.equal(new Set(shared).size, shared.length, 'no duplicate metric/unit survives');
  assert.ok(r.duplicatesRemoved > 0); assert.equal(r.records.length, distinct(r.records));
  assert.equal(r.status, 'partial', 'a duplicate load is reported as partial');
});

test('a repeated page request is ignored instead of counted twice', () => {
  const one = { page: 1, payload: page(1, ['alpha']) };
  const r = merge([one, { page: 1, payload: page(1, ['alpha']) }]);
  assert.equal(r.pagesRequested, 1); assert.equal(r.duplicatesRemoved, 0);
  assert.ok(r.warnings.some(w => w.includes('Duplicate page 1')));
});

test('a hole between pages is reported and downgrades to partial', () => {
  const r = merge([{ page: 1, payload: page(1, ['alpha']) }, { page: 3, payload: page(3, ['gamma'], 3) }]);
  assert.deepEqual(r.missingPages, [2]); assert.equal(r.status, 'partial');
  assert.ok(r.warnings.some(w => w.includes('Missing pages: 2')));
  assert.equal(r.truncated, false, 'a gap is not a budget stop'); });

test('the 4-A source request cap stops paging and marks truncation', () => {
  assert.equal(AA_MAX_PAGES, DEFAULT_REQUEST_POLICY.maxRequests);
  assert.equal(pageAllowed(AA_MAX_PAGES), false, 'the 11th request is refused');
  assert.equal(pageAllowed(AA_MAX_PAGES - 1), true, 'the 10th request still fits');
  assert.equal(pageAllowed(1, { maxRequests: 2 }), true);
  assert.equal(pageAllowed(2, { maxRequests: 2 }), false, 'policy override is honoured');
  const many = Array.from({ length: AA_MAX_PAGES + 3 },
    (_, i) => ({ page: i + 1, payload: page(i + 1, [`m${i}`], AA_MAX_PAGES + 3) }));
  const r = merge(many);
  assert.equal(r.pagesRequested, AA_MAX_PAGES, 'only admitted pages count as requested');
  assert.equal(r.pagesSucceeded, AA_MAX_PAGES); assert.equal(r.truncated, true);
  assert.equal(r.status, 'partial'); assert.equal(r.records.length, distinct(r.records));
  assert.ok(r.warnings.some(w => w.includes('4-A cap')), r.warnings.join(' | '));
});

test('a failed page keeps the other page and is surfaced as partial', () => {
  const r = merge([{ page: 1, payload: page(1, ['alpha']) }, { page: 2, failure: 'Synthetic 503' }]);
  assert.equal(r.status, 'partial'); assert.equal(r.pagesSucceeded, 1);
  assert.deepEqual(models(r.records), ['alpha']);
  assert.ok(r.warnings.some(w => w.includes('Synthetic 503'))); });

test('every page failing is a source failure with no records', () => {
  const r = merge([{ page: 1, failure: 'Synthetic 503' }, { page: 2, failure: 'Syn 429' }]);
  assert.equal(r.status, 'failed'); assert.equal(r.records.length, 0);
  assert.ok(r.warnings.some(w => w.includes('every requested page failed')));
  assert.ok(r.warnings.some(w => w.includes('no usable measurements'))); });

test('an unusable payload is a page-level rejection, not a crash', () => {
  const r = merge([{ page: 1, payload: { tier: 'unknown' } }, { page: 2, payload: page(2, ['beta']) }]);
  assert.equal(r.status, 'partial'); assert.equal(r.pagesSucceeded, 1);
  assert.ok(r.warnings.some(w => w.startsWith('Page 1 rejected:'))); });

test('invalid row pages keep the usable rows and never invent a measurement', () => {
  const broken = { ...page(2, ['beta']), data: [{ id: 'x' }] };
  const r = merge([{ page: 1, payload: page(1, ['alpha']) }, { page: 2, payload: broken }]);
  assert.ok(r.records.length > 0 && r.records.every(x => Number.isFinite(x.value) && x.value >= 0));
  assert.ok(r.warnings.some(w => /page 2 row \d+:/.test(w))); });

test('the record key covers the duplicate-load identity from 4-A', () => {
  const [first] = merge([{ page: 1, payload: page(1, ['alpha']) }]).records;
  assert.ok(first);
  const key = aaRecordKey(first);
  assert.ok(key.includes('"artificial-analysis"') && key.includes('"alpha"'));
  assert.equal(aaRecordKey({ ...first }), key);
  for (const patch of [{ unit: 'other' }, { schemaVersion: 'aa-v2-pro' }, { category: 'other' }])
    assert.notEqual(aaRecordKey({ ...first, ...patch }), key);
});
