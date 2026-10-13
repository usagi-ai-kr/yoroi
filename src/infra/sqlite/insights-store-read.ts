import type { DatabaseSync } from 'node:sqlite';
import { shiftInsightDate, type InsightDailyKey, type InsightHistoryDay, type InsightSeriesKey,
  type InsightSuccess } from '../../insights/history-port.js';
import type { InsightRecord, InsightSource } from '../../insights/record.js';
import type { ValidatedInsightRecord } from '../../insights/validation.js';
import { isInsightSource } from '../../insights/types.js';
import { isIsoDate, isText } from '../../insights/parse-utils.js';

/** 저장·복원하는 정규화 필드만. rawBody 같은 추가 속성은 어디에도 남지 않는다. */
const RECORD_FIELDS = ['source', 'modelId', 'modelAlias', 'metric', 'value', 'unit', 'metadata', 'category',
  'observedAt', 'sourceAsOf', 'sourceUrl', 'sourceName', 'license', 'attributionText', 'method',
  'schemaVersion'] as const;

/** requestScope·schemaVersion 형식(비밀 방어선). 이 밖의 값은 거부한다. */
export const SAFE_INSIGHT_ID = /^[A-Za-z0-9._:@-]{1,128}$/;

interface DailyRow { readonly payload: string }
interface HistoryRow {
  readonly source: string; readonly model_id: string; readonly metric: string; readonly unit: string;
  readonly category: string; readonly schema_version: string; readonly request_scope: string;
  readonly comparison_date: string | null; readonly observed_at: string; readonly value: number;
  readonly model_alias: string | null; readonly source_as_of: string; readonly source_url: string;
  readonly source_name: string; readonly license: string | null; readonly attribution_text: string;
  readonly method: string; readonly metadata: string | null;
}

/** 키 형식 검증은 메모리 구현과 동일하게 RangeError로 끝난다. */
export function assertDailyKey(key: InsightDailyKey): void {
  if (!isInsightSource(key.source) || !isIsoDate(key.publicationDate) || !isText(key.schemaVersion) ||
    !SAFE_INSIGHT_ID.test(key.requestScope)) throw new RangeError('Invalid insight history key');
}
export function assertSeriesKey(key: InsightSeriesKey): void {
  assertDailyKey({ ...key, publicationDate: '2000-01-01' });
  if (![key.modelId, key.metric, key.unit, key.category].every(isText)) {
    throw new RangeError('Invalid insight series'); }
}

/** 정규화 필드만 남긴다. 메모리 구현의 RECORD_FIELDS 필터와 같은 결과다. */
export function pickRecord(record: InsightRecord): InsightRecord {
  const picked: Record<string, unknown> = {};
  for (const field of RECORD_FIELDS) if (record[field] !== undefined) picked[field] = record[field];
  return picked as unknown as InsightRecord;
}

/** 컬럼 한 행을 정규화 InsightRecord로 되돌린다(S2 스키마의 정규화 컬럼만 쓴다). */
export function toMeasurement(row: HistoryRow): ValidatedInsightRecord {
  const record: InsightRecord = {
    source: row.source as InsightSource, modelId: row.model_id, metric: row.metric, value: row.value,
    unit: row.unit, category: row.category, observedAt: row.observed_at, sourceAsOf: row.source_as_of,
    sourceUrl: row.source_url, sourceName: row.source_name, license: row.license,
    attributionText: row.attribution_text, method: row.method, schemaVersion: row.schema_version,
    ...(row.model_alias !== null && { modelAlias: row.model_alias }),
    ...(row.metadata !== null && { metadata: JSON.parse(row.metadata) as NonNullable<InsightRecord['metadata']> }),
  };
  return { record, comparisonDate: row.comparison_date,
    ...(row.comparison_date === null && { comparisonUnavailable: 'n/a: 기준일 미상' as const }) };
}

const SERIES_SQL = 'source = ? AND model_id = ? AND metric = ? AND unit = ? AND category = ?'
  + ' AND schema_version = ? AND request_scope = ?';

/** S1 InsightHistoryPort의 읽기 절반. 메모리 구현과 같은 계약·같은 오류로 끝난다. */
export class SqliteInsightHistoryReader {
  constructor(protected readonly db: DatabaseSync) {}

  getDaily(key: InsightDailyKey, options: { readonly includePartial?: boolean } = {}): InsightSuccess | undefined {
    assertDailyKey(key);
    const row = this.db.prepare(`SELECT payload FROM insight_daily WHERE source = ? AND publication_date = ?
      AND request_scope = ? AND schema_version = ? AND (complete = 1 OR ? = 1)`).get(key.source, key.publicationDate,
      key.requestScope, key.schemaVersion, options.includePartial === true ? 1 : 0) as DailyRow | undefined;
    return row ? JSON.parse(row.payload) as InsightSuccess : undefined;
  }

  protected onDate(key: InsightSeriesKey, date: string): ValidatedInsightRecord | undefined {
    assertSeriesKey(key);
    const row = this.db.prepare(`SELECT * FROM insight_history WHERE ${SERIES_SQL} AND comparison_date = ?`)
      .get(key.source, key.modelId, key.metric, key.unit, key.category, key.schemaVersion,
        key.requestScope, date) as HistoryRow | undefined;
    return row ? toMeasurement(row) : undefined;
  }

  /** 정확히 comparisonDate 하루 전만. 더 가까운 과거 값으로 대체하지 않는다. */
  previous(key: InsightSeriesKey, comparisonDate: string): ValidatedInsightRecord | undefined {
    return this.onDate(key, shiftInsightDate(comparisonDate, -1));
  }

  /** throughDate까지 실제 7일 오름차순 슬롯. 결측은 비워 둔다. */
  sevenDays(key: InsightSeriesKey, throughDate: string): readonly InsightHistoryDay[] {
    assertSeriesKey(key);
    return Array.from({ length: 7 }, (_, index) => {
      const date = shiftInsightDate(throughDate, index - 6);
      const measurement = this.onDate(key, date);
      return measurement ? { date, measurement } : { date }; });
  }
}
