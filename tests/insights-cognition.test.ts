import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CognitionParseError, parseCognitionResponse } from '../src/insights/cognition-parser.js';
const observedAt = '2026-01-04T12:00:00.000Z';
const fixture = JSON.parse(await readFile(new URL('./fixtures/insights/cognition-sample.json', import.meta.url), 'utf8'));
const parse = (payload = fixture, time = observedAt) => parseCognitionResponse(payload, time);
const cell = fixture.v1.data['Synthetic Model A'].high.main;

test('Cognition normalizes v1 metrics with internal-only provenance', () => {
  const result = parse({ v1: fixture.v1 })[0]; assert.ok(result?.ok);
  assert.deepEqual(result.records.map(row => [row.metric, row.value, row.unit]), [
    ['correct', 0.5, 'ratio'], ['new_score', 0.45, 'ratio'],
    ['cost', 1.5, 'usd'], ['tokens', 1000, 'tokens'],
  ]);
  const row = result.records[0]!;
  assert.equal(row.source, 'cognition'); assert.equal(row.modelId, 'Synthetic Model A');
  assert.equal(row.modelAlias, 'Synthetic Model A');
  assert.equal(row.category, 'v1/high/main'); assert.equal(row.license, null);
  assert.equal(row.schemaVersion, 'cognition-frontiercode-v1');
  assert.equal(row.method, 'official-dataset');
  assert.equal(row.observedAt, observedAt); assert.equal(row.sourceAsOf, observedAt);
  assert.equal(row.sourceUrl, 'https://cognition.com/data/frontiercode-leaderboard/data.json');
  assert.equal(row.metadata?.internalOnly, true);
  assert.equal(row.metadata?.sourceAsOfBasis, 'observedAt-fallback');
  assert.equal(row.metadata?.harness, 'synthetic-harness');
  assert.match(row.attributionText, /Internal use only/);
});

test('Cognition v1_1 emits optional duration/tool/steps/flagged metrics', () => {
  const v11 = parse().find(result => result.ok && result.records[0]?.category.startsWith('v1_1/low'));
  assert.ok(v11?.ok);
  assert.deepEqual(v11.records.map(row => row.metric), ['correct', 'new_score', 'cost', 'tokens',
    'duration_min', 'tool_calls', 'steps', 'flagged_rate']);
  assert.equal(v11.records[0]?.schemaVersion, 'cognition-frontiercode-v1_1');
  assert.equal(v11.records.find(row => row.metric === 'tool_calls')?.value, 5.4);
  assert.equal(v11.records.find(row => row.metric === 'steps')?.unit, 'count');
});

test('Cognition omits null metrics and preserves zero', () => {
  const payload = { v1: { ...fixture.v1, data: { 'Synthetic Model A':
    { high: { main: { ...cell, tokens: null, cost: 0 } } } } } };
  const result = parse(payload)[0]; assert.ok(result?.ok);
  assert.deepEqual(result.records.map(row => [row.metric, row.value]),
    [['correct', 0.5], ['new_score', 0.45], ['cost', 0]]);
});

test('Cognition isolates bad cells and warns on unknown fields without leaking values', () => {
  const bad = { ...cell, correct: 1.5 };
  const meanCounts = { ...cell, tool_calls: 16.4, steps: 34.3 };
  const secret = { ...cell, secret_unknown_key: 'SYNTHETIC_SECRET' };
  const payload = { v1: { ...fixture.v1, data: { 'Synthetic Model A':
    { high: { main: cell, ext: bad, mean: meanCounts, extra: secret } } } } };
  const results = parse(payload);
  assert.deepEqual(results.map(result => result.ok), [true, false, true, true]);
  assert.deepEqual(results.map(result => result.index), [0, 1, 2, 3]);
  assert.deepEqual(results[2]?.ok && results[2].records.map(row => [row.metric, row.value]),
    [['correct', 0.5], ['new_score', 0.45], ['cost', 1.5], ['tokens', 1000],
     ['tool_calls', 16.4], ['steps', 34.3]]);
  assert.ok(results[3]?.warnings.some(warning => /unknown fields/.test(warning)));
  assert.ok(!JSON.stringify(results).includes('SYNTHETIC_SECRET'));
  assert.ok(!JSON.stringify(results).includes('secret_unknown_key'));
});

test('Cognition prefers v1_1 and never mixes revisions for the same model', () => {
  const results = parse();
  const revisions = new Set(results.filter(result => result.ok).flatMap(result =>
    result.ok ? result.records.map(row => row.metadata?.revision) : []));
  assert.deepEqual([...revisions], ['v1_1']);
  assert.ok(results.every(result => !result.ok || result.records.every(row => !row.category.startsWith('v1/'))));
});

test('Cognition falls back to v1 only when v1_1 is absent or empty', () => {
  assert.deepEqual(parse({ v1: fixture.v1 }).map(result => result.ok ? result.records[0]?.category : undefined), ['v1/high/main']);
  assert.deepEqual(parse({ v1_1: { ...fixture.v1_1, data: {} }, v1: fixture.v1 })
    .map(result => result.ok ? result.records[0]?.category : undefined), ['v1/high/main']);
  const v11 = parse({ v1_1: fixture.v1_1 })[0];
  assert.deepEqual(v11?.ok ? v11.records[0]?.category : undefined, 'v1_1/low/main');
  assert.deepEqual(parse({ v1_1: { ...fixture.v1_1, data: {} }, v1: { ...fixture.v1, data: {} } }), []);
});

test('Cognition validates envelope and timestamps; accepts empty data', () => {
  for (const payload of [null, {}, { v1: {} }, { v1: { models: [] } },
    { v1: { models: [], subsets: {}, data: [] } }])
    assert.throws(() => parse(payload), CognitionParseError);
  for (const time of ['invalid', '2026-02-30T00:00:00Z'])
    assert.throws(() => parse(fixture, time), CognitionParseError);
  assert.deepEqual(parse({ v1: { ...fixture.v1, data: {} } }), []);
});
