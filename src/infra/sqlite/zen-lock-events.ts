import type { DatabaseSync } from 'node:sqlite';
import type { ZenLockEvent } from '../../app/zen-lock-port.js';

interface EventRow { id: number; kind: 'exceeded' | 'cleared'; model: string | null; observed_at: string; retry_at: string | null }

/** Read-only view of lock_events (kept out of zen-lock-store.ts for the 100-line limit). Ascending id. */
export function lockEventsSince(db: DatabaseSync, scope: string, afterId: number, limit: number): readonly ZenLockEvent[] {
  const rows = db.prepare(`SELECT id, kind, model, observed_at, retry_at FROM lock_events
    WHERE scope = ? AND id > ? ORDER BY id ASC LIMIT ?`).all(scope, afterId, limit) as unknown as EventRow[];
  return rows.map(r => ({ id: r.id, kind: r.kind, observedAt: r.observed_at,
    ...(r.model !== null && { model: r.model }), ...(r.retry_at !== null && { retryAt: r.retry_at }) }));
}

/** Highest event id for the scope, 0 when none. */
export function latestLockEventId(db: DatabaseSync, scope: string): number {
  return Number((db.prepare('SELECT MAX(id) AS id FROM lock_events WHERE scope = ?').get(scope) as { id: number | null }).id ?? 0);
}
