import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCognitionTop10Records } from '../src/insights/cognition-top10.js';
import { parseCognitionResponse } from '../src/insights/cognition-parser.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import { DEFAULT_REQUEST_SCOPES, DEFAULT_SCHEMA_VERSIONS } from '../src/insights/run-once-steps.js';
import { validateInsightRows } from '../src/insights/validation.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';

const AT = '2026-10-13T00:30:00.000Z';
const payload = { v1_1: { models: ['GPT-6 Luna'], subsets: { main: 100 }, data: {
  'GPT-6 Luna': { max: { main: { correct: 0.478, cost: 0.15, duration_min: 12 }, extended: { correct: 0.91, cost: 0.1, duration_min: 8 } },
    low: { main: { correct: 0.42 } }, none: { main: { correct: 0.3 } } },
} } };
const rows = (at: string) => validateInsightRows('cognition', parseCognitionResponse(payload, at));
const port: InsightSourcePort = { id: 'cognition', fetch: async () => payload, parse: parseCognitionResponse };

test('Cognition helper forwards main correct, cost, duration, normalized names and effort suffixes', () => {
  const result = rows(AT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(buildCognitionTop10Records(result.records), [
    { modelId: 'gpt-6-luna-max', metric: 'cognition_correct', value: 0.478 },
    { modelId: 'gpt-6-luna-max', metric: 'cognition_cost', value: 0.15 },
    { modelId: 'gpt-6-luna-max', metric: 'cognition_duration_min', value: 12 },
    { modelId: 'gpt-6-luna-low', metric: 'cognition_correct', value: 0.42 },
    { modelId: 'gpt-6-luna', metric: 'cognition_correct', value: 0.3 },
  ]);
});

test('run-once forwards current Cognition and uses the exact prior publication snapshot when available', async () => {
  const history = new MemoryInsightHistory(), previous = rows('2026-10-12T00:30:00.000Z');
  assert.equal(previous.ok, true);
  assert.equal(history.saveDaily({ source: 'cognition', publicationDate: '2026-10-12',
    requestScope: DEFAULT_REQUEST_SCOPES.cognition, schemaVersion: DEFAULT_SCHEMA_VERSIONS.cognition }, previous), true);
  const run = await runInsightsOnce({ ports: [port], history, now: () => AT });
  const current = rows(AT);
  assert.equal(current.ok, true);
  if (!current.ok) return;
  assert.deepEqual(run.top10?.cognitionRecords, buildCognitionTop10Records(current.records));
  assert.ok(!run.top10?.warnings?.some(w => w.includes('Cognition')));
});

test('missing prior Cognition holds both role comparisons', async () => {
  const run = await runInsightsOnce({ ports: [port], history: new MemoryInsightHistory(), now: () => AT });
  assert.ok(run.top10?.warnings?.some(w => w.includes('Cognition') && w.includes('비교를 보류')));
  assert.deepEqual(run.top10?.previousRanks, []);
});
