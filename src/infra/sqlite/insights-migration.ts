import type { Migration } from './migrations.js';

/** 인사이트(#70) 전용 DDL. v1~v4와 같은 schema_migrations 台帳을 쓰므로 등록 순서와 무관하다.
 * 원문 응답·HTML·자격증명 컬럼은 두지 않는다. daily.payload 는 T1이 정규화한 레코드 JSON이다. */
const V5: Migration = {
  version: 5,
  sql: `
    /* 일일 결과: S1 InsightDailyKey(source, publicationDate, requestScope, schemaVersion). 실패는 저장하지 않는다. */
    CREATE TABLE insight_daily (
      source TEXT NOT NULL,
      publication_date TEXT NOT NULL,
      request_scope TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      complete INTEGER NOT NULL DEFAULT 1 CHECK(complete IN (0, 1)),
      record_count INTEGER NOT NULL CHECK(record_count >= 0),
      payload TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (source, publication_date, request_scope, schema_version)
    );
    CREATE INDEX idx_insight_daily_date ON insight_daily(publication_date);
    /* 비교 이력: S1 InsightHistoryKey 그룹 + 측정 dedup 는 실제 comparisonDate.
       comparison_date 가 NULL 이면 기준일 미상이라 SQLite UNIQUE 가 NULL 을 서로 다르게 봐 중복 억제가 되지 않는다. */
    CREATE TABLE insight_history (
      source TEXT NOT NULL,
      model_id TEXT NOT NULL,
      metric TEXT NOT NULL,
      unit TEXT NOT NULL,
      category TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      request_scope TEXT NOT NULL,
      publication_date TEXT NOT NULL,
      comparison_date TEXT,
      observed_at TEXT NOT NULL,
      value REAL NOT NULL,
      model_alias TEXT,
      source_as_of TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_name TEXT NOT NULL,
      license TEXT,
      attribution_text TEXT NOT NULL,
      method TEXT NOT NULL,
      metadata TEXT,
      UNIQUE (source, model_id, metric, unit, category, schema_version, request_scope, comparison_date)
    );
    CREATE INDEX idx_insight_history_prune ON insight_history(publication_date);
    CREATE INDEX idx_insight_history_series ON insight_history(
      source, model_id, metric, unit, category, schema_version, request_scope, comparison_date);`,
};

/** 인사이트 저장소가 열 때 적용할 목록. migrations.ts 등록은 I1이 한다(그 전까지는 이 상수만 쓴다). */
export const INSIGHTS_MIGRATIONS: readonly Migration[] = [V5];
