import { computeUsageDelta } from '../domain/usage-delta.js';
import type { UsageDelta } from '../domain/usage-delta-types.js';
import type { UsageSnapshot } from '../domain/usage.js';
import type { UsageCache, UsageCacheKey, UsageClock } from './usage-cache-port.js';
import type { UsageHistory } from './usage-history-port.js';
import type { UsageResultMeta } from './usage-result-meta.js';
import { SourceError, type UsageSource } from './usage-source.js';

export interface CachedSourceOptions {
  readonly key: UsageCacheKey;
  readonly cache: UsageCache;
  readonly history?: UsageHistory;
  readonly clock?: UsageClock;
  readonly refresh?: boolean;
}

/** Same format the SQLite adapters enforce, checked at construction so configuration errors surface early. */
const SAFE_ID = /^[A-Za-z0-9._:@-]{1,64}$/;
/** The newest recorded sample is not the displayed snapshot, so no honest delta exists. */
const NOT_COMPARABLE: UsageDelta = { status: 'n/a', reason: 'no-previous' };

/** Read-through source; composition copies meta onto the corresponding result after read.
 * One instance belongs to one collection; concurrent reads on an instance are unsupported.
 * Persistence is best effort and never retries or repeats a provider read. */
export class CachedSource implements UsageSource {
  readonly provider: UsageSource['provider'];
  private lastMeta: UsageResultMeta | undefined;
  private readonly clock: UsageClock;

  constructor(private readonly source: UsageSource, private readonly options: CachedSourceOptions) {
    if (source.provider !== options.key.provider) throw new RangeError('Cache provider mismatch');
    const { scope, contractVersion, lookup } = options.key;
    if (!SAFE_ID.test(scope) || !SAFE_ID.test(contractVersion) || lookup.length < 1 || lookup.length > 128) {
      throw new RangeError('Invalid cache key identity');
    }
    this.provider = source.provider;
    this.clock = options.clock ?? Date.now;
  }

  get meta(): UsageResultMeta | undefined { return this.lastMeta; }

  async read(signal?: AbortSignal): Promise<UsageSnapshot> {
    this.lastMeta = undefined;
    if (signal?.aborted) throw new SourceError('cancelled');
    const now = this.clock();
    let hit: UsageSnapshot | undefined;
    if (!this.options.refresh) {
      try { hit = this.options.cache.get(this.options.key, now); } catch { /* miss */ }
    }
    if (hit && !(Date.parse(hit.observedAt) <= now)) hit = undefined; // future/invalid rows are misses
    if (hit) {
      this.lastMeta = { cache: { hit: true, ageMs: now - Date.parse(hit.observedAt) },
        ...this.deltas(hit) };
      return hit;
    }
    const snapshot = await this.source.read(signal);
    if (signal?.aborted) throw new SourceError('cancelled');
    if (snapshot.provider !== this.provider) throw new SourceError('parse');
    try { this.options.cache.set(this.options.key, snapshot); } catch { /* preserve collection */ }
    let recorded = false;
    if (this.options.history) {
      try { this.options.history.record(snapshot, this.options.key); recorded = true; }
      catch { /* no stale delta after a failed history write */ }
    }
    this.lastMeta = { cache: { hit: false,
      ageMs: Math.max(0, this.clock() - Date.parse(snapshot.observedAt)) },
      ...(recorded ? this.deltas(snapshot) : {}) };
    return snapshot;
  }

  private deltas(snapshot: UsageSnapshot): Pick<UsageResultMeta, 'deltas'> {
    if (!this.options.history) return {};
    const deltas: Record<string, ReturnType<typeof computeUsageDelta>> = Object.create(null);
    for (const window of snapshot.windows) {
      try {
        const pair = this.options.history.latestTwo({ ...this.options.key, windowId: window.id, unit: window.unit });
        const stale = pair[0] !== undefined && Date.parse(pair[0].observedAt) !== Date.parse(snapshot.observedAt);
        deltas[window.id] = stale ? NOT_COMPARABLE : computeUsageDelta(pair);
      } catch { /* omit only the unavailable series */ }
    }
    return { deltas };
  }
}
