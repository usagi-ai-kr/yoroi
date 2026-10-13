import type { ProcessRunner } from '../infra/process-port.js';
import { OPENCODE_V2_UNVERIFIED_DIAGNOSTIC, type OpenCodeTarget } from './opencode-models-source.js';
import { PLAN_CATALOG, type PlanCatalogEntry, type PlanModelEntry } from './plan-catalog.js';

export interface OpenCodeFreeModel { readonly provider: 'opencode' | 'opencode-go'; readonly originalId: string; readonly modelId: string }
export interface RuntimeFreeModel extends PlanModelEntry { readonly originalId: string }
export interface RuntimeFreePlan extends PlanCatalogEntry { readonly sourceUrl: string; readonly checkedOn: string; readonly verified: true; readonly models: readonly RuntimeFreeModel[] }
const SOURCE = 'opencode models (CLI)', TIMEOUT_MS = 30_000;

export function parseOpenCodeFreeModels(output: string): OpenCodeFreeModel[] {
  const clean = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
  return clean.split(/\r?\n/).flatMap(line => {
    const id = line.trim(), match = /^(opencode|opencode-go)\/([^\s/]+)$/.exec(id);
    if (!match || !match[2]!.endsWith('-free')) return [];
    const modelId = match[2]!.slice(0, -5).replace(/-(?:preview|contributor)$/g, '').replace(/\./g, '-').toLowerCase();
    return [{ provider: match[1] as OpenCodeFreeModel['provider'], originalId: id, modelId }];
  });
}

export async function collectOpenCodeFreeModels(runner: ProcessRunner, options: {
  readonly signal?: AbortSignal; readonly diagnostic?: (line: string) => void; readonly target?: OpenCodeTarget;
} = {}): Promise<OpenCodeFreeModel[]> {
  const fail = options.diagnostic ?? console.error;
  // V2는 실측 전까지 stub: CLI를 실행하지 않고 빈 목록 + 진단 1줄(근거 opencode-models-source.ts).
  if (options.target === 'v2') { fail(OPENCODE_V2_UNVERIFIED_DIAGNOSTIC); return []; }
  try {
    const result = await runner.run({ executable: 'opencode', args: ['models'], timeoutMs: TIMEOUT_MS }, options.signal);
    if (result.exitCode !== 0) throw new Error('exit');
    return parseOpenCodeFreeModels(result.stdout);
  } catch {
    fail('OpenCode Free discovery failed; runtime Free catalog is empty.');
    return [];
  }
}

export function buildFreeCatalog(list: readonly OpenCodeFreeModel[], checkedOn: string): RuntimeFreePlan[] {
  const plan = (provider: OpenCodeFreeModel['provider'], planId: string, planName: string): RuntimeFreePlan => ({
    planId, planName, tier: 'free', sourceUrl: SOURCE, checkedOn, verified: true,
    models: list.filter(model => model.provider === provider).map(model => ({ modelId: model.modelId,
      displayName: model.originalId, originalId: model.originalId, sourceUrl: SOURCE, checkedOn, verified: true, free: true })),
  });
  return [plan('opencode', 'opencode-zen-free', 'OpenCode Zen Free'), plan('opencode-go', 'opencode-go-free', 'OpenCode Go Free')];
}

export function freeOnlyModelIdsFromCatalog(freeCatalog: readonly PlanCatalogEntry[], paidCatalog: readonly PlanCatalogEntry[] = PLAN_CATALOG): ReadonlySet<string> {
  const paid = new Set(paidCatalog.filter(plan => plan.tier !== 'free').flatMap(plan => plan.models.map(model => model.modelId.toLowerCase())));
  return new Set(freeCatalog.filter(plan => plan.tier === 'free').flatMap(plan => plan.models.map(model => model.modelId.toLowerCase()))
    .filter(modelId => !paid.has(modelId)));
}
