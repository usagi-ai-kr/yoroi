import { rateLimitDelayMs, retryAfterSeconds } from '../domain/errors.js';
import { principalKey, hasPrincipal } from '../app/claude-scope.js';
import { detectKeys, readState, writeState, type DetectStateStore } from '../app/detect-state-port.js';
import { evaluateUsage, type UsageDetectEvent, type UsageDetectState, type UsageDetectThresholds, type UsageSample } from '../app/detect-usage.js';
import { decideProbe, INITIAL_PROBE_STATE, recordProbeAttempt, recordProbeResult, type ProbeBudgetState, type ProbeOutcome } from '../app/probe-budget.js';
import type { UsageObservation } from '../app/usage-history-port.js';
import { SourceError, type UsageSource } from '../app/usage-source.js';
import type { ProviderSettings } from '../config/load-config.js';
import type { ProviderId } from '../domain/usage.js';
import { cacheSources, sourceIdentity, type UsagePersistence } from './cache.js';

export interface UsageProbeContext {
  readonly settings: ProviderSettings; readonly source: UsageSource; readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: string; readonly nowMs: number; readonly state: DetectStateStore; readonly persistence: UsagePersistence;
  readonly thresholds: UsageDetectThresholds; readonly intervals?: Partial<Record<ProviderId, number>>; readonly signal?: AbortSignal;
}
type WindowRef = { id: string; unit: string };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isRefs = (v: unknown): v is WindowRef[] => Array.isArray(v) && v.every(w => isObj(w) && typeof w.id === 'string' && typeof w.unit === 'string');
const isUsageState = (v: unknown): v is UsageDetectState => isObj(v) && typeof v.exhausted === 'boolean' && typeof v.stale === 'boolean';
const isBudget = (v: unknown): v is ProbeBudgetState => isObj(v) && Number.isSafeInteger(v.consecutiveFailures);
const sample = (o: UsageObservation): UsageSample => ({ provider: o.provider, observedAt: o.observedAt, window: o.window });
/** A server that named a delay outranks the generic transport bucket (D1). */
function outcomeOf(error: unknown): ProbeOutcome {
  if (rateLimitDelayMs(error) !== undefined) return 'rate-limited';
  const code = error instanceof SourceError ? error.code : undefined;
  return code === 'unavailable' || code === 'timeout' || code === 'network' ? 'unavailable' : 'failed';
}

/** One provider per cycle: reuse the newest history sample while the call budget says wait (no provider call, no
 * Keychain read); otherwise collect once through the normal cache+history path. Evaluates every known window.
 * The resolved Keychain scope is remembered so later cycles find the history without reading the Keychain. */
export async function detectUsageProvider(ctx: UsageProbeContext): Promise<{ events: UsageDetectEvent[]; error?: string }> {
  const { settings: s, source, env, platform, nowMs, state, persistence } = ctx, id = s.id;
  const deferred = id === 'claude' && s.oauthToken === undefined && platform === 'darwin' && hasPrincipal(source);
  const identity = sourceIdentity(s, env, platform, deferred), scopeKey = `scope:${id}:${identity.scope}`, windowsKey = `windows:${id}:${identity.scope}`;
  const probeKey = detectKeys.probe(id, identity.scope);
  const historyOf = () => (deferred ? state.get(scopeKey) : identity.scope);
  const pairsOf = (refs: WindowRef[]) => { const scope = historyOf(); return scope === undefined ? [] : refs.map(w => ({ w,
    pair: persistence.history.latestTwo({ provider: id, windowId: w.id, unit: w.unit, scope, contractVersion: identity.contractVersion }) })); };
  const refs = readState(state, windowsKey, isRefs) ?? [];
  const known = pairsOf(refs).flatMap(p => (p.pair[0] ? [Date.parse(p.pair[0].observedAt)] : []));
  const budget = readState(state, probeKey, isBudget) ?? INITIAL_PROBE_STATE;
  const decision = decideProbe(id, budget, nowMs, known.length ? Math.max(...known) : undefined, ctx.intervals);
  let error: string | undefined, nextRefs = refs;
  if (decision.allowed) {
    const attempted = recordProbeAttempt(budget, nowMs); writeState(state, probeKey, attempted);
    let principal: string | undefined;
    const wrapped: UsageSource = { provider: source.provider, read: signal => source.read(signal),
      ...(deferred && hasPrincipal(source) && { principal: async (signal?: AbortSignal) => (principal = await source.principal(signal)) }) } as UsageSource;
    try {
      const cached = cacheSources([wrapped], { providers: [s] }, env, persistence, true, () => nowMs, platform)[0]!;
      const snapshot = await cached.read(ctx.signal);
      writeState(state, probeKey, recordProbeResult(attempted, 'success', nowMs));
      nextRefs = snapshot.windows.map(w => ({ id: w.id, unit: w.unit })); writeState(state, windowsKey, nextRefs);
      const key = principal === undefined ? undefined : principalKey({ provider: id, lookup: 'windows:all', ...identity }, principal);
      if (key) state.set(scopeKey, key.scope);
    } catch (e) {
      if (e instanceof SourceError && e.code === 'cancelled') throw e;
      writeState(state, probeKey, recordProbeResult(attempted, outcomeOf(e), nowMs,
        retryAfterSeconds(rateLimitDelayMs(e))));
      error = `usage:${id}:${e instanceof SourceError ? e.code : 'error'}`;
    }
  }
  const events: UsageDetectEvent[] = [];
  for (const { w, pair } of pairsOf(nextRefs)) {
    if (!pair[0]) continue;
    const key = detectKeys.usage(id, w.id, w.unit), previous = readState(state, key, isUsageState);
    const result = evaluateUsage({ latest: sample(pair[0]), ...(pair[1] && { previous: sample(pair[1]) }), ...(previous && { state: previous }), now: nowMs, thresholds: ctx.thresholds });
    writeState(state, key, result.state); events.push(...result.events);
  }
  return { events, ...(error && { error }) };
}
