import type { InsightSource } from './record.js';
import type { InsightValidation, ValidatedInsightRecord } from './validation.js';
import { isIsoDate, isIsoTimestamp } from './parse-utils.js';

export const INSIGHT_HISTORY_RETENTION_DAYS = 90;
export interface InsightDailyKey {
  readonly source: InsightSource;
  readonly publicationDate: string;
  /** Opaque, secret-free request scope: subset/period/filter/revision/access tier. */
  readonly requestScope: string;
  readonly schemaVersion: string;
}
export interface InsightSeriesKey extends Omit<InsightDailyKey, 'publicationDate'> {
  readonly modelId: string;
  readonly metric: string;
  readonly unit: string;
  readonly category: string;
}
/** Publication grouping key; measurement deduplication uses the actual comparisonDate instead. */
export interface InsightHistoryKey extends InsightSeriesKey { readonly publicationDate: string; }
export interface InsightHistoryDay {
  readonly date: string;
  readonly measurement?: ValidatedInsightRecord;
}
/** 단계B: AA 거절 행의 bounded 집계(allowlist 이름·양의 정수 건수만, 원문 없음). 빈 집계는 생략한다. */
export interface RejectionDiagnostics {
  readonly reasons?: Readonly<Record<string, number>>;
  readonly fields?: Readonly<Record<string, number>>;
}
export type InsightSuccess = Extract<InsightValidation, { readonly ok: true }> & {
  /** 재검증 뒤 원본 result에서 부착한 표시용 진단(구 payload에는 없다). */
  readonly rejectionDiagnostics?: RejectionDiagnostics;
};
export interface InsightHistoryPort {
  getDaily(key: InsightDailyKey): InsightSuccess | undefined;
  /** Validated successes only. Failure/empty/incomplete pages never overwrite success.
   * Existing daily success is reused unless refresh=true. False means no write. */
  saveDaily(key: InsightDailyKey, result: InsightValidation,
    options?: { readonly refresh?: boolean; readonly complete?: boolean }): boolean;
  /** Exactly comparisonDate minus one calendar day; never nearest older observation. */
  previous(key: InsightSeriesKey, comparisonDate: string): ValidatedInsightRecord | undefined;
  /** Seven actual dates ending at throughDate, oldest first; missing days remain empty. */
  sevenDays(key: InsightSeriesKey, throughDate: string): readonly InsightHistoryDay[];
  /** Retain today and 89 preceding KST publication days. Returns removed daily snapshots. */
  prune(publicationDate: string): number;
}
export function shiftInsightDate(date: string, days: number): string {
  if (!isIsoDate(date) || !Number.isSafeInteger(days)) throw new RangeError('Invalid insight date');
  const shifted = new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
  if (!isIsoDate(shifted)) throw new RangeError('Invalid insight date');
  return shifted;
}
/** KST publication day is independent of the record's actual comparison date. */
export function insightPublicationDate(observedAt: string): string {
  if (!isIsoTimestamp(observedAt)) throw new RangeError('Invalid insight observation time');
  return new Date(Date.parse(observedAt) + 9 * 3_600_000).toISOString().slice(0, 10);
}
