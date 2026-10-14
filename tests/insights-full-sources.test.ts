import assert from 'node:assert/strict';
import test from 'node:test';
import { COGNITION_FULL_REQUEST_SCOPE, parseCognitionResponse } from '../src/insights/cognition-parser.js';
import { OPENROUTER_FULL_REQUEST_SCOPE, parseOpenRouterResponse } from '../src/insights/openrouter-parser.js';

const AT = '2026-10-13T00:00:00Z';
const orRow = (date: string, slug: string, tokens: number) => ({ date, model_permaslug: slug, total_tokens: tokens });
const orPayload = { meta: { as_of: '2026-10-07T00:00:00Z', start_date: '2026-10-01', end_date: '2026-10-07', version: 'v1' },
  data: [...Array.from({ length: 55 }, (_, i) => orRow('2026-10-05', `model-${String(i).padStart(2, '0')}`, 10000 - i)),
    orRow('2026-10-06', 'model-00', 500), orRow('2026-10-05', 'other', 200000), orRow('2026-10-06', 'other', 300)] };

test('OpenRouter 저장 경로는 top50 컷 없이 전 날짜·모델·other를 보존한다', () => {
  const results = parseOpenRouterResponse(orPayload, AT);
  assert.equal(results.length, 58);
  const records = results.flatMap(r => (r.ok ? r.records : []));
  assert.equal(records.length, 58);
  assert.ok(records.some(x => x.modelId === 'model-54' && x.value === 9946));
  assert.deepEqual([...new Set(records.map(x => x.metadata?.date))].sort(), ['2026-10-05', '2026-10-06']);
  assert.equal(records.filter(x => x.modelId === 'other').every(x => x.metadata?.aggregate === true), true);
});

const cell = (correct: number) => ({ correct, cost: 1 });
const cogData: Record<string, { high: Record<string, unknown>; low?: Record<string, unknown> }> = {};
for (let i = 0; i < 55; i += 1) cogData[`Model ${String(i).padStart(2, '0')}`] = { high: { main: cell(0.1 + i / 100) } };
cogData['Model 00']!.low = { main: cell(0.05) };
cogData['Model 01']!.high.ext = cell(0.9);
const cogPayload = { v1_1: { models: ['synthetic'], subsets: { main: 100 }, data: cogData } };

test('Cognition 저장 경로는 top50 컷 없이 effort·subset·category를 보존한다', () => {
  const results = parseCognitionResponse(cogPayload, AT);
  assert.equal(results.length, 57);
  const records = results.flatMap(r => (r.ok ? r.records : []));
  assert.ok(records.some(x => x.modelId === 'Model 00' && x.metric === 'correct' && x.category === 'v1_1/high/main' && x.value === 0.1));
  assert.ok(records.some(x => x.category === 'v1_1/low/main' && x.metadata?.effort === 'low'));
  assert.ok(records.some(x => x.category === 'v1_1/high/ext' && x.metadata?.subset === 'ext'));
  assert.equal(new Set(records.map(x => x.modelId)).size, 55);
});

test('OR·Cognition 전체 저장 scope는 기존 top50 scope와 구분되는 새 값이다', () => {
  assert.notEqual(OPENROUTER_FULL_REQUEST_SCOPE, 'rankings-daily:day:top50');
  assert.notEqual(COGNITION_FULL_REQUEST_SCOPE, 'frontiercode:data-json:top50');
  for (const scope of [OPENROUTER_FULL_REQUEST_SCOPE, COGNITION_FULL_REQUEST_SCOPE])
    assert.ok(typeof scope === 'string' && !scope.includes('top50'));
});
