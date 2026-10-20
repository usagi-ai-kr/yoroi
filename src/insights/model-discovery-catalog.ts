import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkEligibility } from './model-discovery-eligibility.js';
import { resolveDiscoveryBaseDir } from './model-discovery-config.js';
import type { DiscoveredModel } from './model-discovery-types.js';
import type { PlanCatalogEntry, PlanModelEntry } from './plan-catalog.js';
import { canonicalFreeId, officialFreeListing, officialFreePlans, type OfficialFreeListing } from './opencode-free-official.js';
import { normalizeModelName } from './letter-top10-rank.js';

/** CLI 관측 id('beam')와 공식 id('beam-free')는 같은 free 경로다. 접미사만 떼고 비교한다. */
const routeKey = (id: string): string => canonicalFreeId(id).replace(/-free$/, '');

export interface RejectedDiscoveredModel { readonly modelId: string; readonly reasons: readonly string[] }
export interface DiscoveryEnrollOutcome {
  readonly entries: readonly PlanCatalogEntry[];
  readonly rejected: readonly RejectedDiscoveredModel[];
}

/** 등록 게이트: CLI 관측분과 공식 목록을 교차한다. 공식 목록에 없는 id는 미등록으로 둔다.
 *  verified blanket 승격 없음: 공식 항목의 sourceUrl/checkedOn/plan을 물려받고 effort는 default만 쓴다. */
export function enrollDiscoveredModels(models: readonly DiscoveredModel[],
  listing: OfficialFreeListing = officialFreeListing()): DiscoveryEnrollOutcome {
  const plans = officialFreePlans(listing);
  const planMeta = new Map(plans.map(p => [p.planId, { planName: p.planName, tier: p.tier } as const]));
  const plansByCanon = new Map<string, Set<string>>();
  const officialByRoute = new Map<string, PlanModelEntry>();
  for (const p of plans) for (const m of p.models) {
    const c = routeKey(m.modelId);
    if (!officialByRoute.has(c)) officialByRoute.set(c, m);
    plansByCanon.set(c, (plansByCanon.get(c) ?? new Set()).add(p.planId));
  }
  const enriched: DiscoveredModel[] = [];
  const refused: RejectedDiscoveredModel[] = [];
  for (const m of models) {
    const route = routeKey(m.modelId), off = officialByRoute.get(route);
    if (!off) { refused.push({ modelId: m.modelId, reasons: ['not-officially-listed'] }); continue; }
    // 플랜 귀속: CLI 관측 plan과 공식 plan의 교집합 우선, 비면 공식 집합(권위).
    const agree = [...(plansByCanon.get(route) ?? new Set<string>())].filter(p => new Set(m.planIds).has(p));
    enriched.push({ modelId: off.modelId, displayName: off.displayName, sourceUrl: off.sourceUrl,
      checkedOn: off.checkedOn, verified: true, planIds: agree.length ? agree : [...(plansByCanon.get(route) ?? [])],
      efforts: ['default'], ...(off.free === true ? { free: true } : {}) });
  }
  const { eligible, rejected } = checkEligibility(enriched);
  for (const r of rejected) refused.push({ modelId: r.modelId, reasons: r.reasons });
  const entries = new Map<string, PlanModelEntry[]>();
  for (const m of eligible) {
    const entry: PlanModelEntry = { modelId: m.modelId, displayName: m.displayName, sourceUrl: m.sourceUrl,
      checkedOn: m.checkedOn, verified: true, ...(m.free === true ? { free: true } : {}) };
    for (const planId of m.planIds) {
      const list = entries.get(planId) ?? [];
      if (!list.some(e => normalizeModelName(e.modelId) === normalizeModelName(m.modelId))) list.push(entry);
      entries.set(planId, list);
    }
  }
  return { entries: [...entries].map(([planId, list]) => ({ planId,
    planName: planMeta.get(planId)?.planName ?? planId,
    ...(planMeta.get(planId)?.tier !== undefined ? { tier: planMeta.get(planId)!.tier } : {}),
    models: list })), rejected: refused };
}

/** 스냅샷 읽기 (last-good: 실패·부재는 빈 목록, 기존 파일을 지우지 않는다). */
export function loadDiscoveredSnapshots(baseDir: string = resolveDiscoveryBaseDir()): DiscoveredModel[] {
  let files: string[] = [];
  try {
    files = readdirSync(baseDir).filter(f => f.endsWith('.json'));
  } catch { return []; }
  const out: DiscoveredModel[] = [];
  for (const file of files) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(baseDir, file), 'utf8'));
      const rec = parsed as { providerId?: unknown; models?: unknown };
      if (typeof rec !== 'object' || rec === null || !Array.isArray(rec.models)) continue;
      for (const m of rec.models as DiscoveredModel[]) {
        if (m && typeof m.modelId === 'string') out.push(m);
      }
    } catch { /* 한 파일 실패가 전체를 깨지 않는다 */ }
  }
  return out;
}

/** opt-in 진입점: autoEnroll 명시 true일 때만 스냅샷을 읽어 병합한다. */
export function catalogWithDiscovery(catalog: readonly PlanCatalogEntry[],
  opts?: { autoEnroll?: boolean; baseDir?: string; listing?: OfficialFreeListing }): readonly PlanCatalogEntry[] {
  if (opts?.autoEnroll !== true) return catalog;
  return applyDiscoveryToCatalog(catalog, loadDiscoveredSnapshots(opts.baseDir ?? resolveDiscoveryBaseDir()), opts);
}
/** 명시 목록을 카탈로그에 합친다. ban/exclude는 하류 풀에서 그대로 적용된다. */
export function applyDiscoveryToCatalog(catalog: readonly PlanCatalogEntry[], models: readonly DiscoveredModel[],
  opts?: { autoEnroll?: boolean; listing?: OfficialFreeListing }): readonly PlanCatalogEntry[] {
  if (opts?.autoEnroll !== true) return catalog;
  const { entries } = enrollDiscoveredModels(models, opts.listing ?? officialFreeListing());
  if (!entries.length) return catalog;
  const merged = catalog.map(p => ({ ...p, models: [...p.models] }));
  for (const e of entries) {
    const at = merged.findIndex(p => p.planId === e.planId);
    if (at < 0) { merged.push({ planId: e.planId, planName: e.planName, ...(e.tier !== undefined ? { tier: e.tier } : {}), models: [...e.models] }); continue; }
    for (const m of e.models) if (!merged[at]!.models.some(x => normalizeModelName(x.modelId) === normalizeModelName(m.modelId))) merged[at]!.models.push(m);
  }
  return merged;
}
