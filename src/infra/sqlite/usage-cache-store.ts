import type { DatabaseSync } from 'node:sqlite';
import { USAGE_CACHE_TTL_MS, type UsageCache, type UsageCacheKey } from '../../app/usage-cache-port.js';
import { createSnapshot, type UsageSnapshot, type UsageWindow } from '../../domain/usage.js';
import { resolveDbPath } from './data-dir.js';
import { isBusy, openDatabase, withBusyDeadline } from './database.js';
import { USAGE_MIGRATIONS } from './migrations.js';

export const USAGE_BUSY_TIMEOUT_MS = 100;
/** scope·contractVersion 형식(비밀 방어선): 이 밖의 값은 거부한다. */
export const SAFE_ID = /^[A-Za-z0-9._:@-]{1,64}$/;

/** SQLITE_BUSY(5)·SQLITE_LOCKED(6)는 캐시·이력 경로에서 miss/생략으로 취급한다. database.ts가 원본이다. */
export { isBusy };
/** v1+v2를 적용하며 연결 직후부터 busy_timeout을 100ms로 제한한 연결(Zen 락 연결은 2000ms 유지).
 * 캐시·이력 읽기·쓰기는 withBusyDeadline으로 실제 벽시계 100ms 안에서만 BUSY를 재시도한다(p55). */
export function openUsageDatabase(path: string): DatabaseSync {
  return openDatabase(path, { busyTimeoutMs: USAGE_BUSY_TIMEOUT_MS, migrations: USAGE_MIGRATIONS });
}
const WINDOW_FIELDS = ['id', 'unit', 'used', 'remaining', 'limit', 'percent', 'resetAt', 'periodStart'] as const;
/** 허용된 정규화 필드만 남긴다(원문·헤더 같은 추가 속성은 저장·복원하지 않음). */
function pickWindow(window: UsageWindow): UsageWindow {
  const picked: Record<string, unknown> = {};
  for (const field of WINDOW_FIELDS) if (window[field] !== undefined) picked[field] = window[field];
  return picked as unknown as UsageWindow;
}
function encodeKey(key: UsageCacheKey): string {
  if (!SAFE_ID.test(key.scope) || !SAFE_ID.test(key.contractVersion) ||
    typeof key.lookup !== 'string' || key.lookup.length < 1 || key.lookup.length > 128) {
    throw new RangeError('Invalid usage cache key');
  }
  return JSON.stringify([key.provider, key.lookup, key.scope, key.contractVersion]);
}
function decode(value: string, key: UsageCacheKey, observedAt: string): UsageSnapshot | undefined {
  try {
    const raw = JSON.parse(value) as { provider: never; observedAt: string; windows: UsageWindow[] };
    const snapshot = createSnapshot(raw.provider, raw.observedAt, raw.windows.map(pickWindow));
    return snapshot.provider === key.provider && snapshot.observedAt === observedAt ? snapshot : undefined;
  } catch { return undefined; }
}

export class SqliteUsageCache implements UsageCache {
  constructor(private readonly db: DatabaseSync, private readonly ownsConnection = false) {}

  get(key: UsageCacheKey, now: number): UsageSnapshot | undefined {
    const id = encodeKey(key);
    let row: { value: string; observed_at: string } | undefined;
    try { row = this.busy(() => this.db.prepare('SELECT value, observed_at FROM cache_entries WHERE key = ?').get(id) as typeof row); }
    catch (error) { if (isBusy(error)) return undefined; throw error; }
    if (!row) return undefined;
    const observed = Date.parse(row.observed_at);
    const snapshot = Number.isFinite(observed) ? decode(row.value, key, row.observed_at) : undefined;
    if (!snapshot) { this.drop(id); return undefined; }
    return Number.isFinite(now) && observed <= now && now < observed + USAGE_CACHE_TTL_MS ? snapshot : undefined;
  }

  set(key: UsageCacheKey, snapshot: UsageSnapshot): void {
    const id = encodeKey(key);
    const observed = Date.parse(snapshot.observedAt);
    if (snapshot.provider !== key.provider || !Number.isFinite(observed)) throw new RangeError('Invalid usage snapshot');
    const value = JSON.stringify({ provider: snapshot.provider, observedAt: snapshot.observedAt, windows: snapshot.windows.map(pickWindow) });
    try {
      this.busy(() => this.db.prepare(`INSERT INTO cache_entries (key, value, observed_at, expires_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, observed_at = excluded.observed_at,
          expires_at = excluded.expires_at`).run(id, value, snapshot.observedAt, observed + USAGE_CACHE_TTL_MS));
    } catch (error) { if (!isBusy(error)) throw error; }
  }

  prune(now: number): number {
    try { return Number(this.busy(() => this.db.prepare('DELETE FROM cache_entries WHERE expires_at <= ?').run(now).changes)); }
    catch (error) { if (isBusy(error)) return 0; throw error; }
  }

  close(): void { if (this.ownsConnection) this.db.close(); }
  private busy<T>(run: () => T): T { return withBusyDeadline(this.db, USAGE_BUSY_TIMEOUT_MS, run); }

  private drop(id: string): void {
    try { this.db.prepare('DELETE FROM cache_entries WHERE key = ?').run(id); } catch { /* best effort */ }
  }
}

export function openUsageCache(env: NodeJS.ProcessEnv): UsageCache {
  return new SqliteUsageCache(openUsageDatabase(resolveDbPath(env)), true);
}
