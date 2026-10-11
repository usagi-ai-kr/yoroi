import { compareInsightPrevious, type InsightComparison } from './comparison.js';
import type { InsightRankResult } from './rank-change.js';
import type { InsightTrendResult } from './trend.js';
import type { InsightSource } from './record.js';
import type { ValidatedInsightRecord } from './validation.js';

export interface LetterMeasurement {
  readonly measurement: ValidatedInsightRecord;
  readonly comparison: InsightComparison;
  readonly trend: InsightTrendResult;
}
/** Reference and result must describe one source/metric/category/unit/schema/requestScope. */
export interface LetterRankInput {
  readonly reference: ValidatedInsightRecord;
  readonly previousDate: string | null;
  readonly result: InsightRankResult;
}
export type LetterFailure = 'fetch' | 'parse' | 'empty' | 'incomplete';
export type LetterSourceInput = { readonly source: InsightSource; readonly ok: false; readonly failure: LetterFailure } |
  { readonly source: InsightSource; readonly ok: true; readonly measurements: readonly LetterMeasurement[];
    readonly ranks?: readonly LetterRankInput[]; readonly partial?: boolean };
export interface LetterEvidence {
  readonly id: string; readonly source: InsightSource; readonly sourceName: string;
  readonly modelId: string; readonly metric: string; readonly category: string; readonly schemaVersion: string;
  readonly value: number; readonly unit: string; readonly sourceUrl: string;
  readonly sourceAsOf: string; readonly comparisonDate: string | null; readonly observedAt: string;
  readonly license: string | null; readonly attributionText: string;
  readonly comparison: InsightComparison; readonly trend: InsightTrendResult;
}
export interface LetterRankEvidence extends Omit<LetterEvidence, 'comparison' | 'trend' | 'value' | 'modelId'> {
  readonly previousDate: string | null;
  readonly result: InsightRankResult;
}
export interface LetterSummaryItem { readonly text: string; readonly evidenceIds: readonly string[]; }
export interface LetterSourceCredit {
  readonly source: InsightSource; readonly name: string; readonly url: string;
  readonly attribution: string; readonly license: string | null; readonly observedAt: string;
}
export type LetterSection =
  { readonly kind: 'metadata'; readonly title: string; readonly audience: 'internal'; readonly notice: string;
    readonly publicationDate: string; readonly timeZone: 'Asia/Seoul'; readonly issuedAt: string } |
  { readonly kind: 'summary'; readonly title: string; readonly items: readonly LetterSummaryItem[] } |
  { readonly kind: 'evidence'; readonly title: string; readonly rows: readonly LetterEvidence[] } |
  { readonly kind: 'ranks'; readonly title: string; readonly groups: readonly LetterRankEvidence[] } |
  { readonly kind: 'sources'; readonly title: string; readonly entries: readonly LetterSourceCredit[] } |
  { readonly kind: 'failures'; readonly title: string; readonly entries: readonly {
    readonly source: InsightSource; readonly reason: string }[] } |
  { readonly kind: 'limitations'; readonly title: string; readonly items: readonly string[] };

export function evidenceRow(input: LetterMeasurement, id: string): LetterEvidence {
  const { record: r, comparisonDate } = input.measurement;
  return { id, source: r.source, sourceName: r.sourceName, modelId: r.modelId, metric: r.metric,
    category: r.category, schemaVersion: r.schemaVersion, value: r.value, unit: r.unit,
    sourceUrl: r.sourceUrl, sourceAsOf: comparisonDate === null ? '미상' : r.sourceAsOf, comparisonDate, observedAt: r.observedAt,
    license: r.license, attributionText: r.attributionText,
    comparison: comparisonDate === null ? compareInsightPrevious(input.measurement, undefined) : input.comparison,
    trend: comparisonDate === null ? { status: 'unavailable', reason: 'n/a: 기준일 미상' } : input.trend };
}
export function rankRow(input: LetterRankInput, id: string): LetterRankEvidence {
  const r = input.reference.record;
  return { id, source: r.source, sourceName: r.sourceName, metric: r.metric, category: r.category,
    schemaVersion: r.schemaVersion, unit: r.unit, sourceUrl: r.sourceUrl,
    sourceAsOf: input.reference.comparisonDate === null ? '미상' : r.sourceAsOf,
    comparisonDate: input.reference.comparisonDate, observedAt: r.observedAt,
    license: r.license, attributionText: r.attributionText,
    previousDate: input.reference.comparisonDate === null ? null : input.previousDate,
    result: input.reference.comparisonDate === null ? { comparable: false, reason: 'n/a: 기준일 미상' } : input.result };
}
export function summarizeLetter(rows: readonly LetterEvidence[], groups: readonly LetterRankEvidence[]): readonly LetterSummaryItem[] {
  const items: LetterSummaryItem[] = rows.flatMap(row => row.comparison.comparable && row.comparison.absoluteChange !== 0
    ? [{ text: `${row.sourceName} · ${row.modelId} · ${row.metric}: 전일 대비 ${row.comparison.absoluteChange} ${row.unit}`,
      evidenceIds: [row.id] }] : []);
  for (const group of groups) if (group.result.comparable) for (const change of group.result.changes) {
    if ((change.status === 'ranked' && !change.rankChange) || change.status === 'missing') continue;
    const win = change.windowSize ? `상위 ${change.windowSize} ` : '';
    const detail = change.status === 'entered' ? `${win}진입` : change.status === 'exited' ? `${win}이탈` : `순위 ${change.rankChange! > 0 ? '상승' : '하락'}`;
    items.push({ text: `${group.sourceName} · ${group.metric} · ${change.modelId}: ${detail}`, evidenceIds: [group.id] });
  }
  if (items.length) return items.slice(0, 5);
  const comparable = rows.some(row => row.comparison.comparable) || groups.some(group => group.result.comparable &&
    group.result.changes.some(change => change.status === 'ranked'));
  return [{ text: comparable ? '비교 가능한 항목에서 확인된 변화 없음' : '자료 부족: 확인 가능한 변화 없음', evidenceIds: [] }];
}
