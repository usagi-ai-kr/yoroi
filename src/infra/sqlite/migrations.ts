import type { DatabaseSync } from 'node:sqlite';

export interface Migration { version: number; sql: string }

const V1: Migration = {
    version: 1,
    sql: `
      CREATE TABLE provider_locks (
        scope TEXT PRIMARY KEY,
        state TEXT NOT NULL CHECK(state IN ('locked','clear')),
        model TEXT, reason TEXT, locked_at TEXT, retry_at TEXT, cleared_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE lock_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('exceeded','cleared')),
        model TEXT, observed_at TEXT NOT NULL, retry_at TEXT
      );`,
};
/** 캐시·관측 이력(#71). 시각은 UTC ISO 8601 TEXT, expires_at만 epoch ms. */
const V2: Migration = {
  version: 2,
  sql: `
    CREATE TABLE cache_entries (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX idx_cache_expires ON cache_entries(expires_at);
    CREATE TABLE observation_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      account_scope TEXT NOT NULL,
      contract_version TEXT NOT NULL,
      window_id TEXT NOT NULL, unit TEXT NOT NULL, observed_at TEXT NOT NULL,
      period_start TEXT, reset_at TEXT,
      used REAL, remaining REAL, limit_value REAL, percent REAL,
      CHECK(used IS NULL OR used >= 0), CHECK(remaining IS NULL OR remaining >= 0),
      CHECK(limit_value IS NULL OR limit_value >= 0),
      CHECK(percent IS NULL OR (percent >= 0 AND percent <= 100)),
      UNIQUE(provider, account_scope, contract_version, window_id, unit, observed_at)
    );
    CREATE INDEX idx_obs_latest ON observation_samples(provider, account_scope, window_id, observed_at DESC);
    CREATE INDEX idx_obs_reset ON observation_samples(provider, reset_at);`,
};
/** OpenCode 플러그인 로드 표시(#77). 락 상태가 아닌 사실이라 CHECK 제약이 있는 provider_locks/lock_events에 넣지 않는다. */
const V3: Migration = { version: 3, sql: 'CREATE TABLE plugin_loads (scope TEXT PRIMARY KEY, loaded_at TEXT NOT NULL);' };
/** yoroi detect(#89)의 상태 KV와 단일 실행 임대(행 1개). 값은 호출자가 비밀 없는 JSON으로 만든다. */
const V4: Migration = {
  version: 4,
  sql: `
    CREATE TABLE detect_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE detect_lease (
      id INTEGER PRIMARY KEY CHECK(id = 1), owner TEXT NOT NULL,
      acquired_at_ms INTEGER NOT NULL, renewed_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL
    );`,
};
/** openDatabase 기본값(Zen 락만). 테이블 추가는 usage 어댑터가 USAGE_MIGRATIONS로 적용한다. */
export const MIGRATIONS: readonly Migration[] = [V1];
export const USAGE_MIGRATIONS: readonly Migration[] = [V1, V2];
/** 플러그인 마커 버전(v1|v2) 기록(p43). 기존 행은 NULL로 남고 해석상 v1이다. 전역에서 미사용이던 v6을 쓴다(v5=insights). */
const V6: Migration = { version: 6, sql: 'ALTER TABLE plugin_loads ADD COLUMN loaded_version TEXT;' };
/** Zen 락 저장소가 여는 연결: v1 락 테이블 + v3 로드 표시. v2(캐시·이력)와 독립이라 적용 순서에 의존하지 않는다. */
export const ZEN_MIGRATIONS: readonly Migration[] = [V1, V3, V6];
/** detect 저장소가 여는 연결. 독립 테이블이라 v1~v3과 어떤 순서로 열어도 합집합이 된다. */
export const DETECT_MIGRATIONS: readonly Migration[] = [V4];
/** 인사이트(#70) 저장소 연결: 정의는 insights-migration.ts(v5), 독립 테이블이라 어떤 순서로 열어도 합집합이 된다. */
export { INSIGHTS_MIGRATIONS } from './insights-migration.js';

/** 미적용 버전만 순서대로 적용한다. 재실행해도 변경이 없다.
 * openDatabase는 원래 busy_timeout을 유지하며 SQLITE_BUSY 때 WAL부터 다시 시도한다.
 * 버전별 schema_migrations 台帳이라 ZEN_MIGRATIONS·USAGE_MIGRATIONS을 어떤 순서로 열어도 합집합이 된다. */
export function migrate(db: DatabaseSync, migrations: readonly Migration[] = MIGRATIONS): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(row => row.version),
  );
  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      const done = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(migration.version);
      if (!done) {
        db.exec(migration.sql);
        db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
          .run(migration.version, new Date().toISOString());
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
