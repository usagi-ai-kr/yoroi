import { compareInsightPrevious, type ComparisonUnavailable, type InsightComparison } from './comparison.js';
import { shiftInsightDate, type InsightHistoryPort } from './history-port.js';
import { validateInsightRecord, type ValidatedInsightRecord } from './validation.js';

export interface InsightTrendPoint {
  readonly date: string;
  readonly value: number | null;
  /** Adjacent-day comparison only. Missing measurements have no change. */
  readonly change: InsightComparison | null;
}
export type InsightTrendResult = { readonly status: 'unavailable';
  readonly reason: ComparisonUnavailable | 'n/a: 7일 슬롯 불일치' } |
  { readonly status: 'complete' | 'partial' | 'insufficient-history';
    readonly startDate: string; readonly endDate: string;
    readonly availableDays: number; readonly missingDays: number; readonly missingDates: readonly string[];
    readonly initialLoad: boolean;
    readonly points: readonly InsightTrendPoint[];
    /** Only a complete seven-day series gets a direction; no gap bridging or interpolation. */
    readonly direction: 'increasing' | 'decreasing' | 'unchanged' | 'mixed' | null };

/** Accept S1 sevenDays(key,current.comparisonDate), from the same requestScope/series.
 * current supplies the real source date and unknown-date policy, never a publication/observation fallback.
 * hasEarlierHistory means known observations before this seven-day range (not estimated history). */
export function computeInsightTrend(current: ValidatedInsightRecord,
  slots: ReturnType<InsightHistoryPort['sevenDays']>,
  options: { readonly hasEarlierHistory?: boolean } = {}): InsightTrendResult {
  const gate = compareInsightPrevious(current, undefined);
  if (!gate.comparable && gate.reason !== 'n/a: 이전 기록 없음') return { status: 'unavailable', reason: gate.reason };
  const endDate = current.comparisonDate!;
  let dates: string[];
  try { dates = Array.from({ length: 7 }, (_, index) => shiftInsightDate(endDate, index - 6)); }
  catch { return { status: 'unavailable', reason: 'n/a: 7일 슬롯 불일치' }; }
  if (slots.length !== 7 || slots.some((slot, index) => slot.date !== dates[index])) {
    return { status: 'unavailable', reason: 'n/a: 7일 슬롯 불일치' };
  }
  // C1 checks identity before checking date adjacency. Zero values avoid unrelated arithmetic overflow.
  for (const slot of slots) {
    const value = slot.measurement;
    if (!value) continue;
    const checked = validateInsightRecord(value.record);
    if (value.comparisonDate === null || value.record.metadata?.sourceAsOfBasis === 'observedAt-fallback' ||
      value.record.source === 'artificial-analysis' || value.record.source === 'cognition') {
      return { status: 'unavailable', reason: 'n/a: 기준일 미상' };
    }
    if (!checked.ok || checked.value.comparisonDate !== value.comparisonDate || value.comparisonDate !== slot.date) {
      return { status: 'unavailable', reason: 'n/a: 유효하지 않은 자료' };
    }
    const identity = compareInsightPrevious({ ...current, record: { ...current.record, value: 0 } },
      { ...value, record: { ...value.record, value: 0 } });
    if (!identity.comparable && identity.reason !== 'n/a: 새 데이터 아님' && identity.reason !== 'n/a: 전일 결측') {
      return { status: 'unavailable', reason: identity.reason };
    }
  }
  let seenEarlier = options.hasEarlierHistory ?? false;
  const points = slots.map((slot, index): InsightTrendPoint => {
    if (!slot.measurement) return { date: slot.date, value: null, change: null };
    const change = compareInsightPrevious(slot.measurement, slots[index - 1]?.measurement,
      { hasEarlierHistory: seenEarlier });
    seenEarlier = true;
    return { date: slot.date, value: slot.measurement.record.value, change };
  });
  const missingDates = points.filter(point => point.value === null).map(point => point.date);
  const availableDays = 7 - missingDates.length;
  let direction: 'increasing' | 'decreasing' | 'unchanged' | 'mixed' | null = null;
  if (availableDays === 7) {
    const changes = points.slice(1).map(point => point.change);
    if (changes.every(change => change?.comparable)) {
      const up = changes.some(change => change?.comparable && change.absoluteChange > 0);
      const down = changes.some(change => change?.comparable && change.absoluteChange < 0);
      direction = up && down ? 'mixed' : up ? 'increasing' : down ? 'decreasing' : 'unchanged';
    }
  }
  return { status: availableDays < 2 ? 'insufficient-history' : missingDates.length ? 'partial' : 'complete',
    startDate: dates[0]!, endDate, availableDays, missingDays: missingDates.length, missingDates,
    initialLoad: availableDays <= 1 && !options.hasEarlierHistory, points, direction };
}
