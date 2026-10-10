import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { OpenRouterParseError, parseOpenRouterResponse } from '../src/insights/openrouter-parser.js';
const observedAt = '2026-01-04T12:00:00.000Z';
const fixture = JSON.parse(await readFile(new URL('./fixtures/insights/openrouter-sample.json', import.meta.url), 'utf8'));
const parse = (payload = fixture, time = observedAt) => parseOpenRouterResponse(payload, time);

test('OpenRouter daily v1 parses string totals, preserves dates and attributes CC BY', () => {
  const results = parse(); assert.ok(results[0]?.ok); assert.ok(results[1]?.ok);
  const row = results[0].records[0]!;
  assert.equal(row.value, 12300); assert.equal(row.unit, 'tokens');
  assert.equal(row.modelId, 'synthetic/model-a'); assert.equal(row.source, 'openrouter');
  assert.equal(row.observedAt, observedAt); assert.equal(row.sourceAsOf, fixture.meta.as_of);
  assert.equal(row.metadata?.date, '2026-01-02'); assert.equal(row.metadata?.period, 'day');
  assert.equal(row.license, 'CC-BY-4.0'); assert.equal(row.sourceUrl, 'https://openrouter.ai/rankings');
  assert.equal(row.attributionText, `Source: OpenRouter (openrouter.ai/rankings), as of ${fixture.meta.as_of}.`);
  assert.equal(results[1].records[0]?.modelId, 'other');
  assert.equal(results[1].records[0]?.metadata?.aggregate, true);
});
test('OpenRouter isolates malformed rows and unsafe totals; duplicate is a successful skip', () => {
  const row = fixture.data[0];
  const invalid = [null, { ...row, date: '2026-02-30' }, { ...row, date: '2025-12-31' },
    ...['9007199254740993', '-1', '1.5', '', '1e3', null, true, NaN, Infinity]
      .map(total_tokens => ({ ...row, total_tokens }))];
  const results = parse({ ...fixture, data: [row, ...invalid, row, fixture.data[1]] });
  assert.deepEqual(results.map(result => result.ok), [true, ...invalid.map(() => false), true, true]);
  assert.deepEqual(results.map(result => result.index), results.map((_, index) => index));
});
test('OpenRouter keeps first total and warns for identical and conflicting duplicates', () => {
  const row = fixture.data[0];
  const results = parse({ ...fixture, data: [row, { ...row, total_tokens: 12300 },
    { ...row, total_tokens: '999' }, fixture.data[1]] });
  assert.ok(results.every(result => result.ok));
  assert.deepEqual(results.flatMap(result => result.ok ? result.records.map(record => record.value) : []),
    [12300, 700]);
  for (const index of [1, 2]) {
    const skipped: ReturnType<typeof parse>[number] | undefined = results[index]; assert.ok(skipped?.ok);
    assert.deepEqual(skipped.records, []); assert.match(skipped.warnings[0]!, /first row retained/);
    assert.equal(skipped.warnings.some(warning => warning.includes('conflicting total_tokens')), index === 2);
  }
  const recovered = parse({ ...fixture, data: [{ ...row, total_tokens: 'invalid' }, row] });
  assert.equal(recovered[0]?.ok, false); assert.ok(recovered[1]?.ok);
  assert.equal(recovered[1].records[0]?.value, 12300);
});
test('OpenRouter warns on unknown fields at all levels and never exposes their content', () => {
  const result = parse({ ...fixture, unknown: 'SYNTHETIC_SECRET',
    meta: { ...fixture.meta, next: 'SYNTHETIC_SECRET' },
    data: [{ ...fixture.data[0], secret_unknown_key: 'SYNTHETIC_SECRET' }] })[0];
  assert.ok(result?.ok); assert.equal(result.warnings.length, 3);
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));
  assert.ok(!JSON.stringify(result).includes('secret_unknown_key'));
});
test('OpenRouter rejects invalid metadata and timestamps, accepts empty dataset and safe zeros', () => {
  for (const meta of [null, {}, { ...fixture.meta, version: 'v2' },
    { ...fixture.meta, as_of: 'not-a-time' }, { ...fixture.meta, start_date: '2026-02-30' },
    { ...fixture.meta, start_date: '2026-01-03' }])
    assert.throws(() => parse({ ...fixture, meta }), OpenRouterParseError);
  for (const time of ['invalid', '2026-02-30T00:00:00Z'])
    assert.throws(() => parse(fixture, time), OpenRouterParseError);
  assert.throws(() => parse(null), OpenRouterParseError);
  assert.deepEqual(parse({ ...fixture, data: [] }), []);
  for (const total_tokens of ['0', 0, Number.MAX_SAFE_INTEGER]) {
    const result = parse({ ...fixture, data: [{ ...fixture.data[0], total_tokens }] })[0];
    assert.ok(result?.ok); assert.equal(result.records[0]?.value, Number(total_tokens));
  }
});
