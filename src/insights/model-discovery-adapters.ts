import { normalizeDiscoveryModelId, type DiscoveredModel } from './model-discovery-types.js';
import { parseOpenCodeFreeModels } from './opencode-free-models.js';

export interface DiscoveryContext {
  readonly checkedOn: string;
  readonly verified?: boolean;
  readonly fetchText?: (url: string) => Promise<string>;
  readonly fetchJson?: (url: string) => Promise<unknown>;
  readonly runCommand?: (cmd: string, args: readonly string[]) => Promise<string>;
  readonly signal?: AbortSignal;
}

export interface ProviderDiscoveryAdapter {
  readonly providerId: string;
  discover(ctx: DiscoveryContext): Promise<readonly DiscoveredModel[]>;
}

export function parseOpenCodeDiscovery(output: string, checkedOn: string, verified = false): readonly DiscoveredModel[] {
  if (typeof output !== 'string' || !output.trim()) return [];
  const models = parseOpenCodeFreeModels(output);
  return models.map(m => ({
    modelId: normalizeDiscoveryModelId(m.modelId), displayName: m.originalId,
    sourceUrl: 'https://opencode.ai', checkedOn, verified: verified === true,
    planIds: m.provider === 'opencode' ? ['opencode-zen-free'] : ['opencode-go-free'],
    // CLI 관측 경로는 effort를 알 수 없으므로 default만 둔다(high/max 날조 금지).
    efforts: ['default'],
    free: true,
  }));
}

export function parseOpenRouterDiscovery(payload: unknown, checkedOn: string, verified = false): readonly DiscoveredModel[] {
  if (typeof payload !== 'object' || payload === null || !Array.isArray((payload as { data?: unknown }).data)) return [];
  const rows = (payload as { data: readonly unknown[] }).data, result: DiscoveredModel[] = [];
  for (const item of rows) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || !row.id.trim()) continue;
    const id = normalizeDiscoveryModelId(row.id.trim().replace(/\//g, ':'));
    const displayName = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : row.id.trim();
    result.push({ modelId: id, displayName, sourceUrl: 'https://openrouter.ai/models', checkedOn, verified: verified === true, planIds: [] });
  }
  return result;
}

export function parseOllamaDiscovery(payload: unknown, checkedOn: string, verified = false): readonly DiscoveredModel[] {
  if (typeof payload !== 'object' || payload === null || !Array.isArray((payload as { models?: unknown }).models)) return [];
  const rows = (payload as { models: readonly unknown[] }).models, result: DiscoveredModel[] = [];
  for (const item of rows) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as Record<string, unknown>;
    const raw = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : (typeof row.model === 'string' && row.model.trim() ? row.model.trim() : undefined);
    if (!raw) continue;
    result.push({ modelId: normalizeDiscoveryModelId(raw), displayName: raw, sourceUrl: 'http://localhost:11434', checkedOn, verified: verified === true, planIds: [] });
  }
  return result;
}

export const OPENCODE_ADAPTER: ProviderDiscoveryAdapter = {
  providerId: 'opencode',
  async discover(ctx) {
    if (ctx.runCommand) return parseOpenCodeDiscovery(await ctx.runCommand('opencode', ['models']), ctx.checkedOn, ctx.verified);
    if (ctx.fetchText) return parseOpenCodeDiscovery(await ctx.fetchText('opencode'), ctx.checkedOn, ctx.verified);
    return [];
  },
};

export const OPENROUTER_ADAPTER: ProviderDiscoveryAdapter = {
  providerId: 'openrouter',
  async discover(ctx) {
    if (!ctx.fetchJson) return [];
    return parseOpenRouterDiscovery(await ctx.fetchJson('https://openrouter.ai/api/v1/models'), ctx.checkedOn, ctx.verified);
  },
};

export const OLLAMA_ADAPTER: ProviderDiscoveryAdapter = {
  providerId: 'ollama',
  async discover(ctx) {
    if (!ctx.fetchJson) return [];
    return parseOllamaDiscovery(await ctx.fetchJson('http://localhost:11434/api/tags'), ctx.checkedOn, ctx.verified);
  },
};

export const DISCOVERY_ADAPTERS: Readonly<Record<string, ProviderDiscoveryAdapter>> = {
  opencode: OPENCODE_ADAPTER,
  openrouter: OPENROUTER_ADAPTER,
  ollama: OLLAMA_ADAPTER,
};
