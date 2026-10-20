import { diffRegistry, summarizeDiscoveryDiffs } from './model-discovery-diff.js';
import { checkEligibility } from './model-discovery-eligibility.js';
import { resolveCollection } from './model-discovery-snapshot.js';
import {
  normalizeDiscoveryModelId,
  type DiscoveredModel,
  type DiscoveryDiffSummary,
  type ModelDiscoveryDiff,
  type ModelRegistrySnapshotStore,
} from './model-discovery-types.js';
import { DISCOVERY_ADAPTERS, type ProviderDiscoveryAdapter } from './model-discovery-adapters.js';
import type { ModelDiscoveryConfig } from './model-discovery-config.js';

export interface DiscoveryRunSummary extends DiscoveryDiffSummary {
  readonly errors: number;
}

export interface DiscoveryRunnerOptions {
  readonly config: ModelDiscoveryConfig;
  readonly adapters?: readonly ProviderDiscoveryAdapter[] | Readonly<Record<string, ProviderDiscoveryAdapter>>;
  readonly store?: ModelRegistrySnapshotStore;
  readonly now?: () => number;
  readonly observedAt?: string;
  readonly checkedOn?: string;
  readonly fetchText?: (url: string) => Promise<string>;
  readonly fetchJson?: (url: string) => Promise<unknown>;
  readonly runCommand?: (cmd: string, args: readonly string[]) => Promise<string>;
  readonly signal?: AbortSignal;
}

export interface DiscoveryRunnerResult {
  readonly enabled: boolean;
  readonly summary: DiscoveryRunSummary;
  readonly diffs: readonly ModelDiscoveryDiff[];
  readonly errors: readonly { readonly providerId: string; readonly error: string }[];
}

export async function runModelDiscovery(opts: DiscoveryRunnerOptions): Promise<DiscoveryRunnerResult> {
  const nowMs = opts.now ? opts.now() : Date.now();
  const observedAt = opts.observedAt ?? new Date(nowMs).toISOString();
  const checkedOn = opts.checkedOn ?? observedAt.slice(0, 10);
  if (!opts.config.enabled) {
    return {
      enabled: false,
      summary: { observedAt, providers: 0, added: 0, removed: 0, changed: 0, errors: 0 },
      diffs: [], errors: [],
    };
  }
  const allAdapters: readonly ProviderDiscoveryAdapter[] = Array.isArray(opts.adapters)
    ? opts.adapters
    : Object.values(opts.adapters ?? DISCOVERY_ADAPTERS);
  const targetProviders = opts.config.providers ? new Set(opts.config.providers.map(p => p.trim().toLowerCase())) : undefined;
  const adapters = targetProviders ? allAdapters.filter(a => targetProviders.has(a.providerId.toLowerCase())) : allAdapters;

  const excluded = new Set((opts.config.excluded ?? []).map(normalizeDiscoveryModelId));
  const diffs: ModelDiscoveryDiff[] = [];
  const errors: { providerId: string; error: string }[] = [];

  for (const adapter of adapters) {
    const providerId = adapter.providerId;
    const previous = opts.store ? await opts.store.read(providerId) : undefined;
    try {
      const raw = await adapter.discover({
        checkedOn,
        ...(opts.fetchText !== undefined && { fetchText: opts.fetchText }),
        ...(opts.fetchJson !== undefined && { fetchJson: opts.fetchJson }),
        ...(opts.runCommand !== undefined && { runCommand: opts.runCommand }),
        ...(opts.signal !== undefined && { signal: opts.signal }),
      });
      const filtered = raw.filter((m: DiscoveredModel) => !excluded.has(normalizeDiscoveryModelId(m.modelId)));
      const { eligible } = checkEligibility(filtered);
      const diff = diffRegistry(providerId, observedAt, previous?.models ?? [], eligible);
      diffs.push(diff);
      const res = resolveCollection(previous, providerId, { ok: true, models: eligible, observedAt }, nowMs);
      if (res.changed && res.snapshot && opts.store) {
        await opts.store.write(res.snapshot);
      }
    } catch (err) {
      errors.push({ providerId, error: err instanceof Error ? err.message : String(err) });
      resolveCollection(previous, providerId, { ok: false, error: String(err) }, nowMs);
    }
  }
  const base = summarizeDiscoveryDiffs(diffs);
  return {
    enabled: true,
    summary: { ...base, observedAt: base.observedAt || observedAt, errors: errors.length },
    diffs, errors,
  };
}
