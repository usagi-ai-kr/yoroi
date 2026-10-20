import type { ProcessRunner } from '../infra/process-port.js';
import type { HttpClient } from '../infra/http-client.js';
import { fetchJson } from './fetch-json.js';
import { canonicalFreeId, officialFreeListing, parseOfficialFreeIdsFromPage, parseOfficialModelIds, OFFICIAL_GO_MODELS_URL,
  OFFICIAL_GO_SOURCE_URL, OFFICIAL_ZEN_MODELS_URL, OFFICIAL_ZEN_SOURCE_URL, type OfficialFreeListing } from './opencode-free-official.js';
import type { OpenCodeTarget } from './opencode-models-source.js';
import { PLAN_CATALOG, type PlanCatalogEntry, type PlanModelEntry } from './plan-catalog.js';

export interface OpenCodeFreeModel { readonly provider: 'opencode' | 'opencode-go'; readonly originalId: string; readonly modelId: string }
export interface RuntimeFreeModel extends PlanModelEntry { /** CLI 로 관측된 경우에만 존재(미관측 모델은 합성하지 않는다). */ readonly originalId?: string }
export interface RuntimeFreePlan extends PlanCatalogEntry { readonly sourceUrl: string; readonly checkedOn: string; readonly verified: boolean; readonly models: readonly RuntimeFreeModel[] }
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
  try {
    const args = options.target === 'v2' ? ['models', '--standalone'] : ['models'];
    const result = await runner.run({ executable: 'opencode', args, timeoutMs: TIMEOUT_MS }, options.signal);
    if (result.exitCode !== 0) throw new Error('exit');
    return parseOpenCodeFreeModels(result.stdout);
  } catch {
    fail('OpenCode Free discovery failed; runtime Free catalog is empty.');
    return [];
  }
}

export function buildFreeCatalog(list: readonly OpenCodeFreeModel[], checkedOn: string): RuntimeFreePlan[] {
  const cliPlan = (provider: OpenCodeFreeModel['provider'], planId: string, planName: string): RuntimeFreePlan => ({
    planId, planName, tier: 'free', sourceUrl: SOURCE, checkedOn, verified: false,
    models: list.filter(model => model.provider === provider).map(model => ({ modelId: model.modelId,
      displayName: model.originalId, originalId: model.originalId, sourceUrl: SOURCE, checkedOn, verified: false, free: true })),
  });
  return [cliPlan('opencode', 'opencode-zen-free-observed', 'OpenCode Zen Free (CLI 관측 · 미검증)'),
    cliPlan('opencode-go', 'opencode-go-free-observed', 'OpenCode Go Free (CLI 관측 · 미검증)')];
}

/** 공식 목록(권위) 기반 free 플랜 카탈로그. CLI 관측은 originalId 보강에만 쓴다(verified 승격 아님). */
export function buildOfficialFreeCatalog(list: readonly OpenCodeFreeModel[], checkedOn: string,
  official: OfficialFreeListing): { readonly plans: readonly RuntimeFreePlan[]; readonly observedOnly: readonly string[] } {
  // 관측 키는 '-free' 접미사를 뗀 경로 키로 맞춘다(공식 'minimax-m3.1-flash-free' ↔ CLI 'minimax-m3-1-flash').
  const routeOf = (id: string): string => canonicalFreeId(id).replace(/-free$/, '');
  const observed = new Map(list.map(m => [`${m.provider}/${routeOf(m.modelId)}`, m.originalId] as const));
  const plan = (provider: OpenCodeFreeModel['provider'], planId: string, planName: string, sourceUrl: string,
    ids: readonly string[]): RuntimeFreePlan => ({
    planId, planName, tier: 'free', sourceUrl, checkedOn: official.checkedOn, verified: true,
    models: ids.map((id): RuntimeFreeModel => { const originalId = observed.get(`${provider}/${routeOf(id)}`);
      return { modelId: canonicalFreeId(id), displayName: id, ...(originalId !== undefined && { originalId }),
        sourceUrl, checkedOn: official.checkedOn, verified: true, free: true }; }),
  });
  const officialIds = new Set([...official.zen, ...official.go].map(canonicalFreeId));
  return { plans: [
    plan('opencode', 'opencode-zen-free', 'OpenCode Zen Free', official.sourceUrls[0] ?? SOURCE, official.zen),
    plan('opencode-go', 'opencode-go-free', 'OpenCode Go Free', official.sourceUrls[1] ?? SOURCE, official.go),
  ], observedOnly: list.filter(m => !officialIds.has(canonicalFreeId(m.modelId))).map(m => m.modelId) };
}

/** 공식 페이지의 명시적 Free 표기(권위)와 공개 모델 API 존재 여부(참고)를 함께 읽는다.
 *  페이지 실패 → last-good 정적 스냅샷(확인일 2026-10-20) + honest status. API 실패는 free 판정과 무관. */
/** 공식 페이지(권위) + 공개 모델 API(존재 참고)를 함께 읽는다. 페이지 실패 → last-good 스냅샷. */
export async function collectOfficialFreeListing(client: HttpClient, options: {
  readonly signal?: AbortSignal; readonly timeoutMs?: number;
} = {}): Promise<{ readonly listing: OfficialFreeListing; readonly pageFailed: boolean; readonly apiFailed: boolean }> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const text = async (url: string): Promise<string | undefined> => {
    try {
      const res = await client.request({ method: 'GET', url, timeoutMs }, options.signal);
      return res.status >= 200 && res.status < 300 ? res.body : undefined;
    } catch { return undefined; }
  };
  const json = async (url: string): Promise<readonly string[] | undefined> => {
    try { return parseOfficialModelIds(await fetchJson(client, { url, timeoutMs }, options.signal)); }
    catch { return undefined; }
  };
  const [zenPage, goPage, zenApi, goApi] = await Promise.all([
    text(OFFICIAL_ZEN_SOURCE_URL), text(OFFICIAL_GO_SOURCE_URL),
    json(OFFICIAL_ZEN_MODELS_URL), json(OFFICIAL_GO_MODELS_URL)]);
  const zenIds = zenPage === undefined ? undefined : parseOfficialFreeIdsFromPage(zenPage);
  const goIds = goPage === undefined ? undefined : parseOfficialFreeIdsFromPage(goPage);
  return { listing: officialFreeListing({ ...(zenIds !== undefined && { zenPage: zenIds }), ...(goIds !== undefined && { goPage: goIds }),
      ...(zenApi !== undefined && { zenApi }), ...(goApi !== undefined && { goApi }) }),
    pageFailed: zenIds === undefined && goIds === undefined, apiFailed: zenApi === undefined && goApi === undefined };
}

export function freeOnlyModelIdsFromCatalog(freeCatalog: readonly PlanCatalogEntry[], paidCatalog: readonly PlanCatalogEntry[] = PLAN_CATALOG): ReadonlySet<string> {
  const paid = new Set(paidCatalog.filter(plan => plan.tier !== 'free').flatMap(plan => plan.models.map(model => model.modelId.toLowerCase())));
  return new Set(freeCatalog.filter(plan => plan.tier === 'free').flatMap(plan => plan.models.filter(model => model.verified).map(model => model.modelId.toLowerCase()))
    .filter(modelId => !paid.has(modelId)));
}
