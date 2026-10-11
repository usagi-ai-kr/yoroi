import type { DatabaseSync } from 'node:sqlite';
import { assertLeaseArgs, assertStateEntry, type DetectLease, type DetectStateStore, type LeaseAcquire }
  from '../../app/detect-state-port.js';
import { resolveDbPath } from './data-dir.js';
import { openDatabase, withMigrationRetry } from './database.js';
import { DETECT_MIGRATIONS } from './migrations.js';

/** Same short busy_timeout as the usage cache: detection never stalls on a held write lock. */
export const DETECT_BUSY_TIMEOUT_MS = 100;

interface LeaseRow { owner: string; acquired_at_ms: number; renewed_at_ms: number; expires_at_ms: number }
const toLease = (r: LeaseRow): DetectLease => ({ owner: r.owner, acquiredAtMs: r.acquired_at_ms,
  renewedAtMs: r.renewed_at_ms, expiresAtMs: r.expires_at_ms });

/** SQLite implementation of the DT2 port. Writes run in BEGIN IMMEDIATE transactions so two detectors
 * racing for the lease serialize; SQLITE_BUSY uses the existing bounded retry (no longer waits). */
export class SqliteDetectStateStore implements DetectStateStore {
  constructor(private readonly db: DatabaseSync) {}

  get(key: string): string | undefined {
    assertStateEntry(key);
    return (this.db.prepare('SELECT value FROM detect_state WHERE key = ?').get(key) as { value: string } | undefined)?.value;
  }
  set(key: string, value: string): void {
    assertStateEntry(key, value);
    this.write(() => this.db.prepare(`INSERT INTO detect_state (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value));
  }
  delete(key: string): void {
    assertStateEntry(key);
    this.write(() => this.db.prepare('DELETE FROM detect_state WHERE key = ?').run(key));
  }

  acquireLease(owner: string, nowMs: number, ttlMs: number): LeaseAcquire {
    assertLeaseArgs(owner, nowMs, ttlMs);
    return this.write(() => {
      const held = this.getLease();
      if (held && held.owner !== owner && held.expiresAtMs > nowMs) return { acquired: false, heldBy: held };
      const takeover = held && held.owner !== owner ? held : undefined;
      const lease = { owner, acquiredAtMs: held?.owner === owner ? held.acquiredAtMs : nowMs, renewedAtMs: nowMs, expiresAtMs: nowMs + ttlMs };
      this.db.prepare(`INSERT INTO detect_lease (id, owner, acquired_at_ms, renewed_at_ms, expires_at_ms) VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, acquired_at_ms = excluded.acquired_at_ms,
          renewed_at_ms = excluded.renewed_at_ms, expires_at_ms = excluded.expires_at_ms`)
        .run(lease.owner, lease.acquiredAtMs, lease.renewedAtMs, lease.expiresAtMs);
      return { acquired: true, lease, ...(takeover && { takeover }) } as LeaseAcquire;
    });
  }
  renewLease(owner: string, nowMs: number, ttlMs: number): boolean {
    assertLeaseArgs(owner, nowMs, ttlMs);
    return this.write(() => Number(this.db.prepare('UPDATE detect_lease SET renewed_at_ms = ?, expires_at_ms = ? WHERE id = 1 AND owner = ?')
      .run(nowMs, nowMs + ttlMs, owner).changes) > 0);
  }
  releaseLease(owner: string): void {
    assertLeaseArgs(owner, 0);
    this.write(() => this.db.prepare('DELETE FROM detect_lease WHERE id = 1 AND owner = ?').run(owner));
  }
  getLease(): DetectLease | undefined {
    const row = this.db.prepare('SELECT owner, acquired_at_ms, renewed_at_ms, expires_at_ms FROM detect_lease WHERE id = 1').get() as LeaseRow | undefined;
    return row && toLease(row);
  }
  close(): void { this.db.close(); }

  private write<T>(run: () => T): T {
    return withMigrationRetry(() => {
      this.db.exec('BEGIN IMMEDIATE');
      try { const result = run(); this.db.exec('COMMIT'); return result; }
      catch (error) { this.db.exec('ROLLBACK'); throw error; }
    });
  }
}

export function openDetectStateStore(env: NodeJS.ProcessEnv): DetectStateStore {
  return new SqliteDetectStateStore(openDatabase(resolveDbPath(env),
    { busyTimeoutMs: DETECT_BUSY_TIMEOUT_MS, migrations: DETECT_MIGRATIONS }));
}
