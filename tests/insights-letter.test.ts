import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInsightLetter } from '../src/insights/letter.js';
import type { LetterMeasurement, LetterSourceInput } from '../src/insights/letter-sections.js';
import { compareInsightPrevious } from '../src/insights/comparison.js';
import { computeInsightRankChanges } from '../src/insights/rank-change.js';
import { computeInsightTrend } from '../src/insights/trend.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { validateInsightRecord } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';

const issuedAt = '2026-10-10T15:00:00Z';
const base: InsightRecord = { source: 'arena', modelId: 'A', metric: 'rating', value: 20, unit: 'score', category: 'Text',
  observedAt: '2026-10-10T10:00:00Z', sourceAsOf: '2026-10-10', sourceUrl: 'https://example.test/data',
  sourceName: 'Synthetic Arena', license: 'CC-BY-4.0', attributionText: 'Source: Synthetic Arena', method: 'synthetic', schemaVersion: 'v1' };
function measure(extra: Partial<InsightRecord> = {}): LetterMeasurement {
  const checked = validateInsightRecord({ ...base, ...extra }); assert.ok(checked.ok);
  const prior = validateInsightRecord({ ...checked.value.record, sourceAsOf: '2026-10-09', value: 10 }); assert.ok(prior.ok);
  const store = new MemoryInsightHistory();
  const key = { source: checked.value.record.source, schemaVersion: 'v1', requestScope: 'text', publicationDate: '2026-10-11' };
  store.saveDaily(key, { ok: true, source: key.source, records: [prior.value, checked.value], rejectedRows: 0 });
  const series = { ...key, modelId: checked.value.record.modelId, metric: base.metric, unit: base.unit, category: base.category };
  return { measurement: checked.value, comparison: compareInsightPrevious(checked.value, prior.value),
    trend: computeInsightTrend(checked.value, store.sevenDays(series, '2026-10-10')) };
}
const source = (measurements: readonly LetterMeasurement[]): LetterSourceInput => ({ source: 'arena', ok: true, measurements });

test('structured internal Korean letter preserves citations, collection time, actual date and KST issue day', () => {
  const input = [source([measure()])]; const before = JSON.stringify(input);
  const result = buildInsightLetter(input, issuedAt); assert.ok(result.ok);
  assert.deepEqual(result.sections.map(section => section.kind), ['metadata', 'summary', 'evidence', 'ranks', 'sources', 'failures', 'limitations']);
  const metadata = result.sections.find(section => section.kind === 'metadata')!;
  assert.equal(metadata.publicationDate, '2026-10-11'); assert.equal(metadata.audience, 'internal');
  const rows = result.sections.find(section => section.kind === 'evidence')!.rows;
  assert.equal(rows[0]?.comparisonDate, '2026-10-10'); assert.equal(rows[0]?.observedAt, base.observedAt);
  assert.equal(rows[0]?.sourceUrl, base.sourceUrl); assert.equal(rows[0]?.attributionText, base.attributionText);
  const summary = result.sections.find(section => section.kind === 'summary')!.items;
  assert.deepEqual(summary[0]?.evidenceIds, [rows[0]!.id]); assert.match(summary[0]!.text, /전일 대비 10 score/);
  (rows[0] as { value: number }).value = 999;
  assert.equal(JSON.stringify(input), before, 'output is detached from input');
});

test('summaries cap at five facts and never pad small or unchanged results', () => {
  const many = Array.from({ length: 8 }, (_, index) => measure({ modelId: `M${index}` }));
  const letter = buildInsightLetter([source(many)], issuedAt); assert.ok(letter.ok);
  assert.equal(letter.sections.find(s => s.kind === 'summary')!.items.length, 5);
  const unchanged = buildInsightLetter([source([measure({ value: 10 })])], issuedAt); assert.ok(unchanged.ok);
  assert.match(unchanged.sections.find(s => s.kind === 'summary')!.items[0]!.text, /확인된 변화 없음/);
});

test('AA/Cognition unknown source dates remain n/a and retain attribution with no observation fallback', () => {
  for (const id of ['artificial-analysis', 'cognition'] as const) {
    const item = measure({ source: id, sourceAsOf: base.observedAt, license: null });
    const letter = buildInsightLetter([{ source: id, ok: true, measurements: [item] }], issuedAt); assert.ok(letter.ok);
    assert.match(letter.sections.find(s => s.kind === 'summary')!.items[0]!.text, /자료 부족/);
    assert.ok(letter.sections.find(s => s.kind === 'limitations')!.items.includes('n/a: 기준일 미상'));
    assert.equal(letter.sections.find(s => s.kind === 'evidence')!.rows[0]!.comparisonDate, null);
    assert.equal(letter.sections.find(s => s.kind === 'evidence')!.rows[0]!.sourceAsOf, '미상');
  }
});

test('partial failures retain good evidence; empty or entirely failed runs never produce a success letter', () => {
  const letter = buildInsightLetter([source([measure()]), { source: 'cognition', ok: false, failure: 'fetch' }], issuedAt);
  assert.ok(letter.ok); assert.equal(letter.sections.find(s => s.kind === 'failures')!.entries[0]?.source, 'cognition');
  assert.equal(letter.sections.find(s => s.kind === 'evidence')!.rows.length, 1);
  assert.equal(buildInsightLetter([{ source: 'arena', ok: false, failure: 'parse' }], issuedAt).ok, false);
  assert.equal(buildInsightLetter([source([])], issuedAt).ok, false);
  const partial = buildInsightLetter([{ ...source([measure()]), partial: true } as LetterSourceInput], issuedAt);
  assert.ok(partial.ok && partial.sections.find(s => s.kind === 'failures')!.entries.length === 1);
});

test('C2 rank evidence is scoped and cited; trend gaps and initial history remain explicit', () => {
  const item = measure(); const prior = measure({ sourceAsOf: '2026-10-09' }).measurement;
  const ranks = computeInsightRankChanges({ complete: true, records: [item.measurement] },
    { complete: true, records: [prior] }, 'descending');
  const letter = buildInsightLetter([{ source: 'arena', ok: true, measurements: [item], ranks: [
    { reference: item.measurement, previousDate: '2026-10-09', result: ranks }] }], issuedAt); assert.ok(letter.ok);
  const group = letter.sections.find(s => s.kind === 'ranks')!.groups[0]!;
  assert.equal(group.metric, 'rating'); assert.equal(group.sourceUrl, base.sourceUrl);
  assert.ok(letter.sections.find(s => s.kind === 'limitations')!.items.some(note => /결측/.test(note)));
  assert.throws(() => buildInsightLetter([source([item]), source([item])], issuedAt), RangeError);
});

test('C2 numeric rank movement summaries link to rank evidence', () => {
  const item = measure(), b = measure({ modelId: 'B', value: 30 }).measurement;
  const old = [measure({ sourceAsOf: '2026-10-09', value: 20 }).measurement,
    measure({ sourceAsOf: '2026-10-09', modelId: 'B', value: 5 }).measurement];
  const result = computeInsightRankChanges({ complete: true, records: [item.measurement, b] }, { complete: true, records: old }, 'descending');
  const letter = buildInsightLetter([{ source: 'arena', ok: true, measurements: [item],
    ranks: [{ reference: item.measurement, previousDate: '2026-10-09', result }] }], issuedAt); assert.ok(letter.ok);
  assert.ok(letter.sections.find(s => s.kind === 'summary')!.items.some(item => /순위 상승/.test(item.text) &&
    item.evidenceIds.includes('arena:rank:0')));
});
