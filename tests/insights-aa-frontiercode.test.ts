import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { FRONTIERCODE_METRIC, parseAaResponse } from '../src/insights/aa-parser.js';
import { mergeAaPages } from '../src/insights/aa-pages.js';
import { parseAaPages } from '../src/insights/sources-aa.js';

const AT = '2026-01-04T12:00:00.000Z';
const fixture = JSON.parse(await readFile(new URL('./fixtures/insights/aa-sample.json', import.meta.url), 'utf8'));
const base = fixture.data[0];
const parse = (row: unknown) => parseAaResponse({ ...fixture, data: [row] }, AT)[0]!;
const withFc = (evaluations: Record<string, unknown>) =>
  parse({ ...base, evaluations: { ...base.evaluations, ...evaluations } });

test('new unknown fields at every level warn but never reject the row or leak values', () => {
  const drifted = { ...base, future_top_level: { nested: 'SECRET_FUTURE' },
    evaluations: { ...base.evaluations, future_livebench_index: 77 },
    pricing: { ...base.pricing, price_1m_new_dimension_tokens: 0.2 },
    performance: { ...base.performance, future_latency_ms: 12 },
    artificial_analysis_intelligence_index_cost: { ...base.artificial_analysis_intelligence_index_cost, future_cost: 1 } };
  const result = parseAaResponse({ ...fixture, future_envelope: 'SECRET_ENV',
    pagination: { ...fixture.pagination, future_cursor: 'SECRET_CURSOR' }, data: [drifted] }, AT)[0]!;
  assert.ok(result.ok);
  assert.equal(result.records.find(r => r.metric === 'artificial_analysis_intelligence_index')?.value, 42.25);
  assert.ok(result.warnings.some(w => /unknown fields at model/.test(w)));
  assert.ok(result.warnings.some(w => /unknown fields at evaluations/.test(w)));
  assert.ok(result.warnings.some(w => /unknown fields at pagination/.test(w)));
  assert.ok(!JSON.stringify(result).includes('SECRET'));
  assert.ok(!result.records.some(r => r.metric.includes('future')));
});

test('a frontiercode field is recorded as the auxiliary frontiercode_score metric', () => {
  const result = withFc({ frontiercode_score: 61.5 });
  assert.ok(result.ok);
  const fc = result.records.filter(r => r.metric === FRONTIERCODE_METRIC);
  assert.deepEqual(fc.map(r => [r.value, r.unit]), [[61.5, 'score']]);
  assert.equal(result.records.find(r => r.metric === 'artificial_analysis_intelligence_index')?.value, 42.25);
  assert.ok(!result.warnings.some(w => /frontiercode/i.test(w)), 'no warning when exactly one numeric field exists');
});

test('any frontiercode-named variant maps to the same metric without duplicating it', () => {
  const single = withFc({ frontiercode_v2_score: 70 });
  assert.ok(single.ok);
  assert.deepEqual(single.records.filter(r => r.metric === FRONTIERCODE_METRIC).map(r => r.value), [70]);
  const multi = withFc({ frontiercode_score: 61.5, frontiercode_raw: 99 });
  assert.ok(multi.ok);
  assert.deepEqual(multi.records.filter(r => r.metric === FRONTIERCODE_METRIC).map(r => r.value), [61.5]);
  assert.ok(multi.warnings.some(w => /Multiple frontiercode fields; used evaluations\.frontiercode_score/.test(w)));
});

test('recognized frontiercode fields are not also reported as ignored unknown fields', () => {
  const nested = withFc({ frontiercode_score: 61.5 });
  assert.ok(nested.ok);
  assert.ok(!nested.warnings.some(w => /unknown fields at evaluations/.test(w)));
  const topLevel = parse({ ...base, frontiercode_total: 55 });
  assert.ok(topLevel.ok);
  assert.deepEqual(topLevel.records.filter(r => r.metric === FRONTIERCODE_METRIC).map(r => r.value), [55]);
  assert.ok(!topLevel.warnings.some(w => /unknown fields at model/.test(w)));
});

test('non-numeric frontiercode fields are ignored with a warning and never reject the row', () => {
  const nulled = withFc({ frontiercode_score: null });
  assert.ok(nulled.ok);
  assert.ok(!nulled.records.some(r => r.metric === FRONTIERCODE_METRIC));
  assert.ok(nulled.warnings.some(w => /frontiercode fields present but not numeric/.test(w)));
  const texted = withFc({ frontiercode_score: '61.5' });
  assert.ok(texted.ok, 'a drifted non-numeric frontiercode value must not reject the row');
  assert.ok(!texted.records.some(r => r.metric === FRONTIERCODE_METRIC));
});

test('a payload without frontiercode stays unchanged and warns nothing about it', () => {
  const result = parse(base);
  assert.ok(result.ok);
  assert.ok(!result.records.some(r => r.metric === FRONTIERCODE_METRIC));
  assert.ok(!result.warnings.some(w => /frontiercode/i.test(w)));
});

test('frontiercode records survive the page merge and top selection path', () => {
  const row = { ...base, evaluations: { ...base.evaluations, frontiercode_score: 61.5 } };
  const page = { ...fixture, pagination: { ...fixture.pagination, page: 1 }, data: [row] };
  const merged = mergeAaPages([{ page: 1, payload: page }], { observedAt: AT });
  assert.equal(merged.status, 'ok');
  assert.ok(merged.records.some(r => r.metric === FRONTIERCODE_METRIC && r.value === 61.5));
  const rows = parseAaPages([{ page: 1, payload: page }], AT, {});
  const kept = rows.flatMap(r => r.ok ? r.records : []);
  assert.ok(kept.some(r => r.modelId === base.slug && r.metric === FRONTIERCODE_METRIC));
});
