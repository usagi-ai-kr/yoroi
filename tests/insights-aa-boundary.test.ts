import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import { mergeAaPages } from '../src/insights/aa-pages.js';
import { parseAaPages } from '../src/insights/sources-aa.js';

const AT = '2026-10-12T00:00:00.000Z';
const row = (slug: string) => ({ id: `id-${slug}`, slug, name: `Model ${slug}`,
  release_date: null, model_creator: { id: 'c1', name: 'Creator' },
  evaluations: { artificial_analysis_intelligence_index: 50, artificial_analysis_coding_index: 50 },
  pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 },
  performance: { median_output_tokens_per_second: 40 } });
const page = (n: number, slugs: readonly string[], total = 4) => ({ tier: 'free',
  intelligence_index_version: 4, data: slugs.map(row),
  pagination: { page: n, page_size: 50, total_pages: total, has_more: n < total } });
const code = (want: string) => (e: unknown) => e instanceof SourceError && e.code === want;

test('case 1: all 4 pages succeed within default budget: ok in mergeAaPages and parseAaPages', () => {
  const pages = [1, 2, 3, 4].map(n => ({ page: n, payload: page(n, [`m${n}`], 4) }));
  const merged = mergeAaPages(pages, { observedAt: AT });
  assert.equal(merged.status, 'ok');
  assert.equal(merged.pagesRequested, 4);
  assert.equal(merged.pagesSucceeded, 4);
  assert.equal(merged.truncated, false);
  assert.deepEqual(merged.missingPages, []);
  assert.equal(merged.records.length, 5 * 4); // 5 metrics per model * 4 models
  const rows = parseAaPages(pages, AT, {});
  assert.equal(rows.length, 4);
  assert.ok(rows.every(r => r.ok));
});

test('case 2: server ignores page param and repeats same content: duplicates -> partial / unavailable', () => {
  const repeated = [{ page: 1, payload: page(1, ['alpha'], 2) }, { page: 2, payload: page(1, ['alpha'], 2) }];
  const merged = mergeAaPages(repeated, { observedAt: AT });
  assert.equal(merged.status, 'partial');
  assert.ok(merged.duplicatesRemoved > 0);
  assert.throws(() => parseAaPages(repeated, AT, {}), code('unavailable'));
});

test('case 2-sub: identical page number passed twice is deduplicated at request level', () => {
  const dupe = [{ page: 1, payload: page(1, ['alpha'], 2) }, { page: 1, payload: page(1, ['alpha'], 2) }];
  const merged = mergeAaPages(dupe, { observedAt: AT });
  assert.equal(merged.pagesRequested, 1);
  assert.ok(merged.warnings.some(w => w.includes('Duplicate page 1 ignored')));
});

test('case 3: page 3 fails while pages 1, 2, 4 succeed: partial merge and unavailable parse error', () => {
  const pages = [
    { page: 1, payload: page(1, ['m1'], 4) },
    { page: 2, payload: page(2, ['m2'], 4) },
    { page: 3, failure: 'Synthetic 500 error' },
    { page: 4, payload: page(4, ['m4'], 4) },
  ];
  const merged = mergeAaPages(pages, { observedAt: AT });
  assert.equal(merged.status, 'partial');
  assert.equal(merged.pagesRequested, 4);
  assert.equal(merged.pagesSucceeded, 3);
  assert.deepEqual(merged.missingPages, []);
  assert.ok(merged.warnings.some(w => w.includes('Synthetic 500 error')));
  assert.throws(() => parseAaPages(pages, AT, {}), code('unavailable'));
});

test('case 4: total_pages > 10 budget exceeded: pages 11+ truncated, partial merge and parse failure', () => {
  const pages = Array.from({ length: 12 }, (_, i) => ({
    page: i + 1,
    payload: page(i + 1, [`m${i + 1}`], 12),
  }));
  const merged = mergeAaPages(pages, { observedAt: AT });
  assert.equal(merged.pagesRequested, 10);
  assert.equal(merged.pagesSucceeded, 10);
  assert.equal(merged.truncated, true);
  assert.equal(merged.status, 'partial');
  assert.ok(merged.warnings.some(w => w.includes('Page budget reached') && w.includes('4-A cap')));
  assert.throws(() => parseAaPages(pages, AT, {}), code('unavailable'));
});
