import assert from 'node:assert/strict';
import test from 'node:test';
import { filterCognitionTop50 } from '../src/insights/cognition-top50.js';
import type { InsightRecord } from '../src/insights/record.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';

const record = (modelId: string, metric: string, value: number, category = 'frontiercode'): InsightRecord => ({ source: 'cognition', modelId,
  modelAlias: modelId, metric, value, unit: metric === 'cost' ? 'usd' : 'ratio', category,
  observedAt: '2026-10-12T00:00:00Z', sourceAsOf: '2026-10-12T00:00:00Z', sourceUrl: 'https://cognition.com',
  sourceName: 'Cognition', license: null, attributionText: 'x', method: 'official-api', schemaVersion: 'v1' });
const row = (index: number, modelId: string, metrics: readonly string[], value: number, category = 'frontiercode'): ParseRowResult =>
  ({ ok: true, index, records: metrics.map(metric => record(modelId, metric, metric === 'correct' ? value : 1, category)), warnings: [] });

test('cognition keeps the top 50 by best correct value with ties and all their metrics', () => {
  const rows = [...Array.from({ length: 55 }, (_, i) => row(i, `m${String(100 - i)}`, ['correct', 'cost'], 100 - i)),
    row(55, 'tie', ['correct', 'cost'], 51), row(56, 'no-correct', ['cost'], 0)];
  const kept = filterCognitionTop50(rows).map(entry => entry.index).sort((a, b) => a - b);
  assert.equal(kept.length, 51);          // 50 ranked + 1 tie at the cutoff
  assert.ok(kept.includes(49));           // cutoff model
  assert.ok(kept.includes(55));           // tie at the cutoff
  assert.ok(!kept.includes(56));          // no correct value cannot enter the cohort
  const keptRow = filterCognitionTop50(rows).find(entry => entry.index === 0)!;
  assert.ok(keptRow.ok && keptRow.records.some(record0 => record0.metric === 'cost'), 'all metrics of kept models stay');
});
test('a set of 50 or fewer models keeps every scored model', () => {
  const rows = Array.from({ length: 50 }, (_, i) => row(i, `m${i}`, ['correct'], i));
  assert.equal(filterCognitionTop50(rows).length, 50);
});

test('selection is per comparable category: a low global value can still be the top of its own category', () => {
  const catA = Array.from({ length: 55 }, (_, i) => row(i, `a${String(80 - i)}`, ['correct'], 80 - i, 'v1_1/high/overall'));
  const catB = [row(100, 'star', ['correct'], 1, 'v1_1/high/coding'), row(101, 'peer', ['correct'], 0, 'v1_1/high/coding')];
  const kept = filterCognitionTop50([...catA, ...catB]).map(entry => entry.index);
  assert.ok(kept.includes(100) && kept.includes(101));
  assert.ok(!kept.includes(54));   // category A cutoff at its 50th value keeps a0..a49 only
  assert.ok(kept.includes(49));
});
