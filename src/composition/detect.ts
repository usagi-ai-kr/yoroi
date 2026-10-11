import type { DetectEvent } from '../app/detect-events.js';
import { leaseTtlMs, type DetectStateStore } from '../app/detect-state-port.js';
import { detectZen } from '../app/detect-zen.js';
import type { UsageDetectThresholds } from '../app/detect-usage.js';
import type { UsageSource } from '../app/usage-source.js';
import { SourceError } from '../app/usage-source.js';
import type { ZenLockStore } from '../app/zen-lock-port.js';
import type { RuntimeConfig } from '../config/load-config.js';
import type { ProviderId } from '../domain/usage.js';
import { openDetectStateStore } from '../infra/sqlite/detect-state-store.js';
import { openZenLockStore } from '../infra/sqlite/zen-lock-store.js';
import { openUsagePersistence, type UsagePersistence } from './cache.js';
import { detectUsageProvider } from './detect-usage-probe.js';
import { createSources, type SourceFactories } from './sources.js';

export interface DetectCycleDeps {
  readonly config: RuntimeConfig;
  /** Provider/credential environment (as for `once`) and the data-dir environment (YOROI_DATA_DIR etc.). */
  readonly env: Readonly<Record<string, string | undefined>>; readonly dataEnv: NodeJS.ProcessEnv;
  readonly now: () => number; readonly owner: string; readonly intervalMs: number;
  readonly thresholds: UsageDetectThresholds & { readonly pluginStaleGraceMs: number };
  readonly platform?: string; readonly factories?: SourceFactories; readonly intervals?: Partial<Record<ProviderId, number>>;
  /** Newest OpenCode process start (ms); injected by the caller, absent when unknown. */
  readonly opencodeStartedAtMs?: () => number | undefined; readonly signal?: AbortSignal;
  readonly openState?: () => DetectStateStore; readonly openZen?: () => ZenLockStore; readonly openPersistence?: () => UsagePersistence;
}
export interface DetectCycleResult {
  readonly events: readonly DetectEvent[];
  /** Diagnostics only: component and error code, never messages or values. */
  readonly errors: readonly string[]; readonly skipped?: 'lease-held'; readonly fenced?: true;
}

/** One detection cycle. Each detector fails alone. The lease is acquired and renewed every cycle (its renewal
 * time is the heartbeat). Output is the returned events (DT8 prints).
 *
 * Ownership (D2, unchanged by design): every store the cycle obtains from `openState`/`openZen`/
 * `openPersistence` is closed in the `finally` below, including an injected one. Those hooks are *factories*,
 * not instances — pass one that returns a fresh connection per cycle. A long-lived instance is not rejected up
 * front: the first cycle closes it and every later cycle then fails on the closed database, which is reported
 * as a component error code instead of escaping. This keeps per-cycle
 * connection hygiene (no leak across cycles, a hung detector holds nothing after it returns). */
export async function runDetectCycle(deps: DetectCycleDeps): Promise<DetectCycleResult> {
  const nowMs = deps.now(), ttl = leaseTtlMs(deps.intervalMs), events: DetectEvent[] = [], errors: string[] = [], closers: (() => void)[] = [];
  let state: DetectStateStore;
  try { state = (deps.openState ?? (() => openDetectStateStore(deps.dataEnv)))(); } catch { return { events, errors: ['state:open'] }; }
  closers.push(() => state.close());
  try {
    const lease = state.acquireLease(deps.owner, nowMs, ttl);
    if (!lease.acquired) return { events, errors, skipped: 'lease-held' };
    if (lease.takeover) events.push({ kind: 'detector-gap', observedAt: new Date(nowMs).toISOString(), gapMs: nowMs - lease.takeover.renewedAtMs });
    try {
      const lock = (deps.openZen ?? (() => openZenLockStore(deps.dataEnv)))(); closers.push(() => lock.close());
      const started = deps.opencodeStartedAtMs?.();
      events.push(...detectZen({ lock, state, nowMs, pluginStaleGraceMs: deps.thresholds.pluginStaleGraceMs,
        ...(started !== undefined && { opencodeStartedAtMs: started }) }));
    } catch { errors.push('zen'); }
    let persistence: UsagePersistence | undefined, sources: readonly UsageSource[] = [];
    try {
      const opened = (deps.openPersistence ?? (() => openUsagePersistence(deps.dataEnv)))(); closers.push(() => opened.close());
      sources = createSources(deps.config, deps.factories); persistence = opened;
    } catch { errors.push('usage:open'); }
    for (const [index, settings] of deps.config.providers.entries()) {
      if (!persistence || deps.signal?.aborted) break;
      try {
        const result = await detectUsageProvider({ settings, source: sources[index]!, env: deps.env, platform: deps.platform ?? process.platform,
          nowMs, state, persistence, thresholds: deps.thresholds, ...(deps.intervals && { intervals: deps.intervals }), ...(deps.signal && { signal: deps.signal }) });
        events.push(...result.events); if (result.error) errors.push(result.error);
      } catch (error) { if (!(error instanceof SourceError && error.code === 'cancelled')) errors.push(`usage:${settings.id}`); }
    }
    const fenced = !state.renewLease(deps.owner, deps.now(), ttl);
    return { events, errors, ...(fenced && { fenced: true as const }) };
  } catch { return { events, errors: [...errors, 'state'] }; }
  finally { for (const close of closers.reverse()) try { close(); } catch { /* close errors never change the result */ } }
}

/** Frees the lease on a clean shutdown so a restart does not wait out the 2x interval. */
export function releaseDetectLease(owner: string, openState: () => DetectStateStore): void {
  try { const state = openState(); try { state.releaseLease(owner); } finally { state.close(); } } catch { /* best effort */ }
}
