import type { InsightHistoryPort } from './history-port.js';
import { validateInsightRecord, type ValidatedInsightRecord } from './validation.js';

export type ComparisonUnavailable = 'n/a: 기준일 미상' | 'n/a: 이전 기록 없음' | 'n/a: 전일 결측' |
  'n/a: 비교 조건 불일치' | 'n/a: 유효하지 않은 자료' | 'n/a: 새 데이터 아님' | 'n/a: 수치 범위 초과';
export type InsightComparison = { readonly comparable: false; readonly reason: ComparisonUnavailable } |
  { readonly comparable: true; readonly currentDate: string; readonly previousDate: string;
    /** Signed difference in the original unit, not an absolute magnitude. */
    readonly absoluteChange: number;
    /** Signed difference / magnitude of previous value × 100, including negative score baselines. */
    readonly percentChange: number | null;
    readonly percentUnavailable?: 'n/a: 이전 값 0' | 'n/a: 수치 범위 초과' };

const unknownDate = (value: ValidatedInsightRecord): boolean => value.comparisonDate === null ||
  value.record.source === 'artificial-analysis' || value.record.source === 'cognition' ||
  value.record.metadata?.sourceAsOfBasis === 'observedAt-fallback';
function valid(value: ValidatedInsightRecord): boolean {
  const result = validateInsightRecord(value.record);
  return result.ok && result.value.comparisonDate === value.comparisonDate;
}
/** Caller obtains previous from S1 with the SAME requestScope/series. No history lookup or clock here.
 * hasEarlierHistory distinguishes initial loading from a missing exact previous day; never fill a gap. */
export function compareInsightPrevious(current: ValidatedInsightRecord,
  previous: ReturnType<InsightHistoryPort['previous']>,
  options: { readonly hasEarlierHistory?: boolean } = {}): InsightComparison {
  if (unknownDate(current) || (previous !== undefined && unknownDate(previous))) {
    return { comparable: false, reason: 'n/a: 기준일 미상' };
  }
  if (!valid(current) || (previous !== undefined && !valid(previous))) {
    return { comparable: false, reason: 'n/a: 유효하지 않은 자료' };
  }
  if (!previous) return { comparable: false,
    reason: options.hasEarlierHistory ? 'n/a: 전일 결측' : 'n/a: 이전 기록 없음' };
  const identity = ['source', 'modelId', 'metric', 'unit', 'category', 'schemaVersion', 'method'] as const;
  if (identity.some(field => current.record[field] !== previous.record[field])) {
    return { comparable: false, reason: 'n/a: 비교 조건 불일치' };
  }
  const currentDate = current.comparisonDate!;
  const previousDate = previous.comparisonDate!;
  if (currentDate === previousDate) return { comparable: false, reason: 'n/a: 새 데이터 아님' };
  if (Date.parse(currentDate) - Date.parse(previousDate) !== 86_400_000) {
    return { comparable: false, reason: 'n/a: 전일 결측' };
  }
  const absoluteChange = current.record.value - previous.record.value;
  if (!Number.isFinite(absoluteChange)) return { comparable: false, reason: 'n/a: 수치 범위 초과' };
  const dates = { currentDate, previousDate, absoluteChange };
  if (previous.record.value === 0) return { comparable: true, ...dates, percentChange: null,
    percentUnavailable: 'n/a: 이전 값 0' };
  const percentChange = absoluteChange / Math.abs(previous.record.value) * 100;
  return Number.isFinite(percentChange) ? { comparable: true, ...dates, percentChange }
    : { comparable: true, ...dates, percentChange: null, percentUnavailable: 'n/a: 수치 범위 초과' };
}
