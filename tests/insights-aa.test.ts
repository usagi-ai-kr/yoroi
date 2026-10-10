import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AaParseError, parseAaResponse } from '../src/insights/aa-parser.js';
const observedAt = '2026-01-04T12:00:00.000Z';
const fixture = JSON.parse(await readFile(new URL('./fixtures/insights/aa-sample.json', import.meta.url), 'utf8'));
const parse = (payload = fixture, time = observedAt) => parseAaResponse(payload, time);

test('AA free V2 normalizes finite metrics, skips null and attaches honest provenance', () => {
  const result = parse()[0]; assert.ok(result?.ok);
  assert.deepEqual(result.records.map(row => [row.metric, row.value, row.unit]), [
    ['artificial_analysis_intelligence_index', 42.25, 'score'],
    ['price_1m_input_tokens', 0.5, 'USD/1M tokens'], ['price_1m_output_tokens', 2, 'USD/1M tokens'],
    ['price_1m_cache_hit_tokens', 0.1, 'USD/1M tokens'],
    ['median_output_tokens_per_second', 80, 'tokens/s'],
    ['median_time_to_first_token_seconds', 0.25, 'seconds'],
    ['intelligence_index_total_cost', 12, 'USD'], ['intelligence_index_cost_per_task', 0.12, 'USD/task'],
  ]);
  const row = result.records[0]!;
  assert.equal(row.source, 'artificial-analysis'); assert.equal(row.modelId, 'synthetic-aa-model');
  assert.equal(row.modelAlias, 'Synthetic AA Model'); assert.equal(row.license, null);
  assert.equal(row.observedAt, observedAt); assert.equal(row.sourceAsOf, observedAt);
  assert.equal(row.metadata?.sourceAsOfBasis, 'observedAt-fallback');
  assert.equal(row.metadata?.intelligence_index_version, 4.1);
  assert.match(row.attributionText, /Artificial Analysis.*https:\/\/artificialanalysis.ai/);
  assert.ok(result.warnings.some(message => /unconfirmed/.test(message)));
});
test('AA missing cost objects or individual cost fields preserve other metrics with warnings', () => {
  const base = fixture.data[0];
  const { artificial_analysis_intelligence_index_cost: _cost, ...withoutCost } = base;
  for (const row of [withoutCost, { ...base, artificial_analysis_intelligence_index_cost: null },
    { ...base, artificial_analysis_intelligence_index_cost: { total_cost: 12 } },
    { ...base, artificial_analysis_intelligence_index_cost: { total_cost: 12, cost_per_task: null } },
    { ...base, artificial_analysis_intelligence_index_cost: { cost_per_task: {} } }]) {
    const result = parse({ ...fixture, data: [row] })[0]; assert.ok(result?.ok);
    assert.equal(result.records[0]?.value, 42.25);
    assert.ok(result.records.some(record => record.metric === 'median_output_tokens_per_second'));
    assert.ok(!result.records.some(record => record.metric === 'intelligence_index_cost_per_task'));
    assert.ok(result.warnings.some(warning => warning.includes('Missing')));
    if (row.artificial_analysis_intelligence_index_cost?.total_cost === 12)
      assert.equal(result.records.find(record => record.metric === 'intelligence_index_total_cost')?.value, 12);
  }
});
test('AA isolates bad rows, warns on nested/envelope drift without exposing unknown values', () => {
  const row = fixture.data[0];
  const changed = { ...row, secret_unknown_key: 'SYNTHETIC_SECRET',
    pricing: { ...row.pricing, new_price: 'SYNTHETIC_SECRET' } };
  const outcomes = parse({ ...fixture, unexpected: 'SYNTHETIC_SECRET', data: [row, null,
    { ...row, slug: '' }, changed, { ...row, pricing: { price_1m_input_tokens: '3' } }] });
  assert.deepEqual(outcomes.map(result => result.ok), [true, false, false, true, false]);
  assert.deepEqual(outcomes.map(result => result.index), [0, 1, 2, 3, 4]);
  assert.ok(outcomes[3]?.warnings.some(message => /pricing/.test(message)));
  assert.ok(!JSON.stringify(outcomes).includes('SYNTHETIC_SECRET'));
  assert.ok(!JSON.stringify(outcomes).includes('secret_unknown_key'));
});
test('AA validates envelope, calendar dates, finite metrics and preserves zero', () => {
  for (const payload of [null, {}, { ...fixture, tier: 'unknown' },
    { ...fixture, intelligence_index_version: NaN }, { ...fixture, pagination: {} }])
    assert.throws(() => parse(payload), AaParseError);
  for (const time of ['invalid', '2026-02-30T00:00:00Z']) assert.throws(() => parse(fixture, time), AaParseError);
  for (const change of [{ release_date: '2026-02-30' }, { model_creator: null },
    { performance: { median_output_tokens_per_second: Infinity } },
    { pricing: { price_1m_input_tokens: -1 } }])
    assert.equal(parse({ ...fixture, data: [{ ...fixture.data[0], ...change }] })[0]?.ok, false);
  const zero = parse({ ...fixture, data: [{ ...fixture.data[0], release_date: null,
    evaluations: { artificial_analysis_intelligence_index: 0 } }] })[0];
  assert.ok(zero?.ok); assert.equal(zero.records[0]?.value, 0);
  assert.deepEqual(parse({ ...fixture, data: [] }), []);
});
