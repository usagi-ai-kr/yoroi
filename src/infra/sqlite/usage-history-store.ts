import type { DatabaseSync } from 'node:sqlite';
import type { UsageHistory, UsageHistoryContext, UsageHistoryKey, UsageHistoryRetention,
  UsageObservation, UsageObservationPair } from '../../app/usage-history-port.js';
import type { ProviderId, UsageSnapshot, UsageWindow } from '../../domain/usage.js';
import { resolveDbPath } from './data-dir.js';
import { isBusy, openUsageDatabase, SAFE_ID } from './usage-cache-store.js';

interface Row {
  provider: string; account_scope: string; contract_version: string; window_id: string; unit: string;
  observed_at: string; period_start: string | null; reset_at: string | null;
  used: number | null; remaining: number | null; limit_value: number | null; percent: number | null;
}
/** observed_at는 UTC ISO(ms)로 정규화해 저장하므로 문자열 순서가 시간 순서와 같다. */
function canonical(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new RangeError('Invalid observation time');
  return new Date(time).toISOString();
}
function assertIdentity(value: UsageHistoryContext): void {
  if (!SAFE_ID.test(value.scope) || !SAFE_ID.test(value.contractVersion)) throw new RangeError('Invalid usage history identity');
}
function toObservation(row: Row): UsageObservation {
  const window: UsageWindow = { id: row.window_id, unit: row.unit,
    ...(row.used !== null && { used: row.used }), ...(row.remaining !== null && { remaining: row.remaining }),
    ...(row.limit_value !== null && { limit: row.limit_value }), ...(row.percent !== null && { percent: row.percent }),
    ...(row.reset_at !== null && { resetAt: row.reset_at }),
    ...(row.period_start !== null && { periodStart: row.period_start }) };
  return { provider: row.provider as ProviderId, scope: row.account_scope, contractVersion: row.contract_version,
    observedAt: row.observed_at, window };
}

export class SqliteUsageHistory implements UsageHistory {
  constructor(private readonly db: DatabaseSync, private readonly ownsConnection = false) {}

  record(snapshot: UsageSnapshot, context: UsageHistoryContext): void {
    assertIdentity(context);
    const observedAt = canonical(snapshot.observedAt);
    const insert = this.db.prepare(`INSERT INTO observation_samples (provider, account_scope,
      contract_version, window_id, unit, observed_at, period_start, reset_at, used, remaining, limit_value, percent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, account_scope, contract_version, window_id, unit, observed_at) DO NOTHING`);
    this.transaction(() => {
      for (const w of snapshot.windows) {
        insert.run(snapshot.provider, context.scope, context.contractVersion, w.id, w.unit, observedAt,
          w.periodStart ?? null, w.resetAt ?? null, w.used ?? null, w.remaining ?? null, w.limit ?? null, w.percent ?? null);
      }
    });
  }

  latestTwo(key: UsageHistoryKey): UsageObservationPair {
    assertIdentity(key);
    try {
      const rows = this.db.prepare(`SELECT * FROM observation_samples WHERE provider = ? AND account_scope = ?
        AND contract_version = ? AND window_id = ? AND unit = ? ORDER BY observed_at DESC LIMIT 2`)
        .all(key.provider, key.scope, key.contractVersion, key.windowId, key.unit) as unknown as Row[];
      const [first, second] = rows.map(toObservation);
      return first ? second ? [first, second] : [first] : [];
    } catch (error) { if (isBusy(error)) return []; throw error; }
  }

  prune(retention: UsageHistoryRetention): number {
    if (!Number.isSafeInteger(retention.maxSamples) || retention.maxSamples < 1) throw new RangeError('Invalid maxSamples');
    const before = canonical(retention.before);
    try {
      return this.transaction(() => {
        const old = Number(this.db.prepare('DELETE FROM observation_samples WHERE observed_at < ?').run(before).changes);
        const extra = this.db.prepare(`DELETE FROM observation_samples WHERE id IN (SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY provider, account_scope, contract_version, window_id, unit
            ORDER BY observed_at DESC) AS rn FROM observation_samples) WHERE rn > ?)`).run(retention.maxSamples);
        return old + Number(extra.changes);
      });
    } catch (error) { if (isBusy(error)) return 0; throw error; }
  }

  close(): void { if (this.ownsConnection) this.db.close(); }

  private transaction<T>(run: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = run(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}

export function openUsageHistory(env: NodeJS.ProcessEnv): UsageHistory {
  return new SqliteUsageHistory(openUsageDatabase(resolveDbPath(env)), true);
}
