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
/** openDatabase 기본값(Zen 락만). 테이블 추가는 usage 어댑터가 USAGE_MIGRATIONS로 적용한다. */
export const MIGRATIONS: readonly Migration[] = [V1];
export const USAGE_MIGRATIONS: readonly Migration[] = [V1, V2];

/** 미적용 버전만 순서대로 적용한다. 재실행해도 변경이 없다. */
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
