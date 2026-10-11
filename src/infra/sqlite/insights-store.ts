import type { DatabaseSync } from 'node:sqlite';
import { INSIGHT_HISTORY_RETENTION_DAYS, shiftInsightDate, type InsightDailyKey,
  type InsightHistoryPort } from '../../insights/history-port.js';
import { validateInsightRows, type InsightValidation } from '../../insights/validation.js';
import type { InsightRecord } from '../../insights/record.js';
import { resolveDbPath } from './data-dir.js';
import { openDatabase } from './database.js';
import { INSIGHTS_MIGRATIONS } from './migrations.js';
import { SqliteInsightHistoryReader, assertDailyKey, pickRecord } from './insights-store-read.js';

/** 구독 사용량과 같은 짧은 대기로 연다. 마이그레이션은 인사이트 v5만(다른 목록과 독립). */
export const INSIGHTS_BUSY_TIMEOUT_MS = 100;

const INSERT_HISTORY = `INSERT INTO insight_history (source, model_id, metric, unit, category,
  schema_version, request_scope, publication_date, comparison_date, observed_at, value, model_alias,
  source_as_of, source_url, source_name, license, attribution_text, method, metadata)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT (source, model_id, metric, unit, category, schema_version, request_scope, comparison_date)
  DO UPDATE SET observed_at = excluded.observed_at, value = excluded.value,
    publication_date = excluded.publication_date
  WHERE excluded.observed_at >= insight_history.observed_at`;

export class SqliteInsightHistory extends SqliteInsightHistoryReader implements InsightHistoryPort {
  constructor(db: DatabaseSync) { super(db); }

  /** 실패·빈 성공·불완전 페이지는 저장하지 않고 기존 성공도 지우지 않는다. */
  saveDaily(key: InsightDailyKey, result: InsightValidation,
    options: { readonly refresh?: boolean; readonly complete?: boolean } = {}): boolean {
    assertDailyKey(key);
    const complete = options.complete !== false;
    if (!result.ok || !complete) return false;
    if (result.source !== key.source ||
      result.records.some(value => value.record.schemaVersion !== key.schemaVersion)) return false;
    // 저장 경계에서 재검증해 비교 날짜 위조와 빈 성공을 막는다(메모리 구현과 동일).
    const checked = validateInsightRows(key.source, [{ ok: true, index: 0,
      records: result.records.map(value => value.record), warnings: [] }]);
    if (!checked.ok) return false;
    const success = { ...checked, rejectedRows: result.rejectedRows,
      records: checked.records.map(value => ({ ...value, record: pickRecord(value.record) })) };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (!complete || options.refresh !== true) {
        const existing = this.db.prepare(`SELECT 1 FROM insight_daily WHERE source = ? AND publication_date = ?
          AND request_scope = ? AND schema_version = ?`).get(key.source, key.publicationDate,
          key.requestScope, key.schemaVersion);
        if (existing) { this.db.exec('ROLLBACK'); return false; }
      }
      this.db.prepare(`INSERT INTO insight_daily (source, publication_date, request_scope, schema_version,
        complete, record_count, payload, saved_at) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT (source, publication_date, request_scope, schema_version)
        DO UPDATE SET complete = excluded.complete, record_count = excluded.record_count,
          payload = excluded.payload, saved_at = excluded.saved_at`)
        .run(key.source, key.publicationDate, key.requestScope, key.schemaVersion, complete ? 1 : 0,
          success.records.length, JSON.stringify(success), new Date().toISOString());
      for (const measurement of success.records) {
        if (measurement.comparisonDate === null) continue; // 기준일 미상은 일일 최신 결과로만 남긴다
        const { record } = measurement;
        this.db.prepare(INSERT_HISTORY).run(record.source, record.modelId, record.metric, record.unit,
          record.category, record.schemaVersion, key.requestScope, key.publicationDate,
          measurement.comparisonDate, record.observedAt, record.value, record.modelAlias ?? null,
          record.sourceAsOf, record.sourceUrl, record.sourceName, record.license,
          record.attributionText, record.method, record.metadata === undefined ? null
          : JSON.stringify(record.metadata));
      }
      this.db.exec('COMMIT');
      return true;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** 소유한 연결만 닫는다. */
  close(): void { this.db.close(); }

  /** 당일과 직전 89일 발행 자료를 보존한다. 제거된 일일 스냅샷 수를 돌려준다. */
  prune(publicationDate: string): number {
    const cutoff = shiftInsightDate(publicationDate, 1 - INSIGHT_HISTORY_RETENTION_DAYS);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const removed = Number(this.db.prepare('DELETE FROM insight_daily WHERE publication_date < ?')
        .run(cutoff).changes);
      this.db.prepare('DELETE FROM insight_history WHERE publication_date < ?').run(cutoff);
      this.db.exec('COMMIT');
      return removed;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function openInsightsHistory(env: NodeJS.ProcessEnv): SqliteInsightHistory {
  return new SqliteInsightHistory(openDatabase(resolveDbPath(env),
    { busyTimeoutMs: INSIGHTS_BUSY_TIMEOUT_MS, migrations: INSIGHTS_MIGRATIONS }));
}
