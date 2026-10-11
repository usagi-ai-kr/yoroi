import type { DatabaseSync } from 'node:sqlite';
import type { ZenLockState, ZenLockStore } from '../../app/zen-lock-port.js';
import { applyExceeded, applyOk } from '../../app/zen-lock-memory.js';
import { resolveDbPath } from './data-dir.js';
import { openDatabase } from './database.js';
import { ZEN_MIGRATIONS } from './migrations.js';

const MAX_EVENTS = 200;

interface Row {
  scope: string; state: 'locked' | 'clear'; model: string | null; reason: string | null;
  locked_at: string | null; retry_at: string | null; cleared_at: string | null; updated_at: string;
}

function toState(row: Row): ZenLockState {
  return {
    scope: row.scope, state: row.state, updatedAt: row.updated_at,
    ...(row.model !== null && { model: row.model }),
    ...(row.reason !== null && { reason: row.reason }),
    ...(row.locked_at !== null && { lockedAt: row.locked_at }),
    ...(row.retry_at !== null && { retryAt: row.retry_at }),
    ...(row.cleared_at !== null && { clearedAt: row.cleared_at }),
  };
}

export class SqliteZenLockStore implements ZenLockStore {
  constructor(private readonly db: DatabaseSync) {}

  get(scope: string): ZenLockState | undefined {
    const row = this.db.prepare('SELECT * FROM provider_locks WHERE scope = ?').get(scope) as Row | undefined;
    return row && toState(row);
  }

  markExceeded(input: { scope: string; model?: string; reason?: string; observedAt: string; retryAt?: string }): ZenLockState {
    return this.transaction(() => {
      const next = applyExceeded(this.get(input.scope), input);
      if (!next) return this.get(input.scope)!;
      this.db.prepare(`INSERT INTO provider_locks (scope, state, model, reason, locked_at, retry_at, cleared_at, updated_at)
        VALUES (?, 'locked', ?, ?, ?, ?, NULL, ?)
        ON CONFLICT(scope) DO UPDATE SET state = 'locked', model = excluded.model, reason = excluded.reason,
          locked_at = excluded.locked_at, retry_at = excluded.retry_at, cleared_at = NULL, updated_at = excluded.updated_at`)
        .run(input.scope, next.model ?? null, next.reason ?? null, next.lockedAt ?? input.observedAt,
          next.retryAt ?? null, next.updatedAt);
      this.addEvent(input.scope, 'exceeded', input.model, input.observedAt, input.retryAt);
      return this.get(input.scope)!;
    });
  }

  markOk(input: { scope: string; model?: string; observedAt: string }): { changed: boolean; state?: ZenLockState } {
    return this.transaction(() => {
      const prev = this.get(input.scope);
      const result = applyOk(prev, input);
      if (!prev || result.state === prev) return result;
      if (result.changed) {
        this.db.prepare("UPDATE provider_locks SET state = 'clear', cleared_at = ?, updated_at = ? WHERE scope = ?")
          .run(input.observedAt, input.observedAt, input.scope);
        this.addEvent(input.scope, 'cleared', input.model, input.observedAt);
      } else {
        this.db.prepare('UPDATE provider_locks SET updated_at = ? WHERE scope = ?').run(input.observedAt, input.scope);
      }
      return { changed: result.changed, state: this.get(input.scope)! };
    });
  }

  /** 늦게 도착한 기록이 더 최근 로드 시각을 되돌리지 않는다(ISO UTC 문자열 비교). */
  markLoaded(input: { scope: string; observedAt: string }): void {
    this.db.prepare(`INSERT INTO plugin_loads (scope, loaded_at) VALUES (?, ?)
      ON CONFLICT(scope) DO UPDATE SET loaded_at = MAX(loaded_at, excluded.loaded_at)`).run(input.scope, input.observedAt);
  }

  loadedAt(scope: string): string | undefined {
    return (this.db.prepare('SELECT loaded_at FROM plugin_loads WHERE scope = ?').get(scope) as { loaded_at?: string } | undefined)?.loaded_at;
  }

  close(): void {
    this.db.close();
  }

  private addEvent(scope: string, kind: string, model: string | undefined, observedAt: string, retryAt?: string): void {
    this.db.prepare('INSERT INTO lock_events (scope, kind, model, observed_at, retry_at) VALUES (?, ?, ?, ?, ?)')
      .run(scope, kind, model ?? null, observedAt, retryAt ?? null);
    this.db.prepare('DELETE FROM lock_events WHERE id <= (SELECT MAX(id) FROM lock_events) - ?').run(MAX_EVENTS);
  }

  private transaction<T>(run: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = run();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function openZenLockStore(env: NodeJS.ProcessEnv): ZenLockStore {
  return new SqliteZenLockStore(openDatabase(resolveDbPath(env), { migrations: ZEN_MIGRATIONS }));
}
