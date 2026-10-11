import assert from 'node:assert/strict';
import test from 'node:test';
import { computeInsightRankChanges, type InsightRankSnapshot } from '../src/insights/rank-change.js';
import { rankRow, summarizeLetter, type LetterRankEvidence } from '../src/insights/letter-sections.js';
import { buildInsightLetter } from '../src/insights/letter.js';
import { validateInsightRecord, type ValidatedInsightRecord } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';
import { compareInsightPrevious } from '../src/insights/comparison.js';
import { buildRanks } from '../src/insights/run-once-steps.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';

const baseRecord = (modelId: string, value: number, date: string): ValidatedInsightRecord => {
  const raw: InsightRecord = { source: 'arena', modelId, metric: 'rating', value, unit: 'score',
    category: 'overall', observedAt: '2026-10-11T00:00:00Z', sourceAsOf: date,
    sourceUrl: 'https://example.test/arena', sourceName: 'Synthetic Arena', license: 'CC-BY-4.0',
    attributionText: 'Synthetic', method: 'synthetic', schemaVersion: 'v1' };
  const res = validateInsightRecord(raw); assert.ok(res.ok); return res.value;
};
const snapshot = (pairs: readonly (readonly [string, number])[], date: string, windowSize?: number): InsightRankSnapshot =>
  ({ records: pairs.map(([id, val]) => baseRecord(id, val, date)), complete: true, ...(windowSize ? { windowSize } : {}) });

test('window of top 20: disappeared model indicates exit from top 20 window (rank > 20)', () => {
  const priorPairs = Array.from({ length: 20 }, (_, i) => [`M${String(i + 1).padStart(2, '0')}`, 100 - i] as const);
  const priorSnap = snapshot(priorPairs, '2026-10-09', 20);

  const currPairs = [...priorPairs.slice(0, 19), ['NewM', 80.5] as const];
  const currSnap = snapshot(currPairs, '2026-10-10', 20);

  const result = computeInsightRankChanges(currSnap, priorSnap, 'descending');
  assert.ok(result.comparable);

  const m20 = result.changes.find(c => c.modelId === 'M20')!;
  assert.equal(m20.status, 'exited');
  assert.equal(m20.currentRank, null);
  assert.equal(m20.previousRank, 20);
  assert.equal(m20.rankChange, null);

  const newM = result.changes.find(c => c.modelId === 'NewM')!;
  assert.equal(newM.status, 'entered');
  assert.equal(newM.currentRank, 20);
  assert.equal(newM.previousRank, null);
  assert.equal(newM.rankChange, null);
});

test('summarizeLetter reflects top window entry and exit notes', () => {
  const priorSnap = snapshot([['M1', 100], ['M2', 90]], '2026-10-09', 20);
  const currSnap = snapshot([['M1', 100], ['M3', 95]], '2026-10-10', 20);
  const result = computeInsightRankChanges(currSnap, priorSnap, 'descending');
  assert.ok(result.comparable);

  const ref = currSnap.records[0]!;
  const group: LetterRankEvidence = rankRow({ reference: ref, previousDate: '2026-10-09', result }, 'arena:rank:0');
  const summary = summarizeLetter([], [group]);

  const m2Summary = summary.find(s => s.text.includes('M2'));
  assert.ok(m2Summary?.text.includes('상위 20 이탈'));
  const m3Summary = summary.find(s => s.text.includes('M3'));
  assert.ok(m3Summary?.text.includes('상위 20 진입'));
});

test('letter limitations include top 20 window notes explicitly', () => {
  const item = baseRecord('M1', 100, '2026-10-10');
  const prior = baseRecord('M1', 95, '2026-10-09');
  const comparison = compareInsightPrevious(item, prior);
  const mInput = { measurement: item, comparison, trend: { status: 'unavailable' as const, reason: 'n/a: 기준일 미상' as const } };
  const ranks = computeInsightRankChanges(snapshot([['M1', 100]], '2026-10-10'), snapshot([['M1', 95]], '2026-10-09'), 'descending');

  const letter = buildInsightLetter([{
    source: 'arena', ok: true, measurements: [mInput],
    ranks: [{ reference: item, previousDate: '2026-10-09', result: ranks }]
  }], '2026-10-11T12:00:00Z');

  assert.ok(letter.ok);
  const limitations = letter.sections.find(s => s.kind === 'limitations')!;
  assert.ok(limitations.items.some(it => it.includes('상위 20(Arena overall, AA 코딩 지수)만')));
});

test('run-once buildRanks synthesizes top 20 labels in summary', () => {
  const store = new MemoryInsightHistory();
  const k = { source: 'arena' as const, publicationDate: '2026-10-09', requestScope: 'overall', schemaVersion: 'v1' };
  store.saveDaily(k, { ok: true, source: 'arena', records: [baseRecord('M1', 100, '2026-10-09'), baseRecord('M2', 90, '2026-10-09')], rejectedRows: 0 });
  const today = { ok: true as const, source: 'arena' as const, records: [baseRecord('M1', 100, '2026-10-10'), baseRecord('M3', 95, '2026-10-10')], rejectedRows: 0 };
  const ranks = buildRanks(store, 'overall', '2026-10-10', today, true, 5);
  const m = { measurement: today.records[0]!, comparison: compareInsightPrevious(today.records[0]!, baseRecord('M1', 100, '2026-10-09')), trend: { status: 'unavailable' as const, reason: 'n/a: 기준일 미상' as const } };
  const letter = buildInsightLetter([{ source: 'arena', ok: true, measurements: [m], ranks }], '2026-10-11T12:00:00Z');
  assert.ok(letter.ok);
  const summary = letter.sections.find(s => s.kind === 'summary')!;
  assert.ok(summary.items.some(it => it.text.includes('M2: 상위 20 이탈')));
  assert.ok(summary.items.some(it => it.text.includes('M3: 상위 20 진입')));
});
