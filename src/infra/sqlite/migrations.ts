import type { DatabaseSync } from 'node:sqlite';

export interface Migration { version: number; sql: string }

export const MIGRATIONS: readonly Migration[] = [
  {
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
  },
];

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
