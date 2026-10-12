import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceRow, summarizeLetter, type LetterEvidence, type LetterMeasurement } from '../src/insights/letter-sections.js';
import { validateInsightRecord } from '../src/insights/validation.js';
import { compareInsightPrevious } from '../src/insights/comparison.js';
import type { InsightRecord } from '../src/insights/record.js';

const record = (value: number, date: string, modelId = 'm1'): InsightRecord => ({ source: 'openrouter', modelId,
  metric: 'total_tokens', value, unit: 'tokens', category: 'language-models', observedAt: '2026-10-11T00:00:00Z',
  sourceAsOf: date, metadata: { date }, sourceUrl: 'https://openrouter.ai/rankings', sourceName: 'OpenRouter',
  license: 'CC-BY-4.0', attributionText: 'Source: OpenRouter', method: 'official-api', schemaVersion: 'v1' });
const validated = (rec: InsightRecord) => { const res = validateInsightRecord(rec); assert.ok(res.ok); return res.value; };
const measurement = (value: number, date: string): LetterMeasurement => {
  const current = validated(record(value, date));
  const previous = validated(record(value - 3_038_708_458_397, '2026-10-04'));
  return { measurement: current, comparison: compareInsightPrevious(current, previous),
    trend: { status: 'unavailable', reason: 'n/a: 기준일 미상' } };
};

test('summary deltas carry the exact previous/current dates so past-day changes are not read as today', () => {
  const row = evidenceRow(measurement(4_100_000_000_000, '2026-10-05'), 'openrouter:measurement:0');
  const items = summarizeLetter([row], []);
  assert.ok(items[0]!.text.includes('(2026-10-04→2026-10-05)'), items[0]!.text);
});
test('evidence display values are rounded while huge counts stay exact', () => {
  const rounded = evidenceRow(measurement(4_100_000_000_000, '2026-10-05'), 'id1');
  assert.equal(rounded.value, 4_100_000_000_000);
  const arena = evidenceRow({ measurement: validated({ ...record(1533.8551230242795, '2026-10-08'), source: 'arena',
    sourceName: 'LMArena', sourceUrl: 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset',
    metric: 'rating', unit: 'score', category: 'overall', schemaVersion: 'arena-hf-v1' } as InsightRecord),
    comparison: { comparable: false, reason: 'n/a: 이전 기록 없음' },
    trend: { status: 'unavailable', reason: 'n/a: 기준일 미상' } }, 'id2');
  assert.equal(arena.value, 1533.8551);
});
test('summary keeps the raw comparison semantics (dates still validated by the comparison layer)', () => {
  const row: LetterEvidence = evidenceRow(measurement(4_100_000_000_000, '2026-10-05'), 'id3');
  assert.ok(row.comparison.comparable);
  assert.equal(row.comparison.currentDate, '2026-10-05');
  assert.equal(row.comparison.previousDate, '2026-10-04');
});

test('tiny nonzero costs keep significant digits instead of rounding to zero', () => {
  const small = evidenceRow({ measurement: validated({ ...record(0.00001234, '2026-10-05'), unit: 'USD',
    metric: 'intelligence_index_cost_per_task' } as InsightRecord),
    comparison: { comparable: false, reason: 'n/a: 이전 기록 없음' },
    trend: { status: 'unavailable', reason: 'n/a: 기준일 미상' } }, 'id4');
  assert.equal(small.value, 0.00001234);
  const zero = evidenceRow({ measurement: validated(record(0, '2026-10-05')), comparison: { comparable: false, reason: 'n/a: 이전 기록 없음' },
    trend: { status: 'unavailable', reason: 'n/a: 기준일 미상' } }, 'id5');
  assert.equal(zero.value, 0);
});
