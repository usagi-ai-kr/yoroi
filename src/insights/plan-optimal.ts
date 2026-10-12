import { splitBaseAndEffort, groupVariants, type ModelVariant } from './letter-top10-group.js';
import { filterCandidates } from './letter-top10-filter.js';
import { type OptimalZoneRole } from './letter-top10-worker.js';
import { OPTIMAL_ZONE_THRESHOLDS } from './letter-top10-worker.js';
import { PLAN_CATALOG, type PlanCatalogEntry } from './plan-catalog.js';
import { normalizeModelName, type Top10RecordInput } from './letter-top10-rank.js';

/** 정액제 내 추가 비용은 0이므로 가성비·단가 정렬 대신 지수 순으로 표시한다(근거: docs/insights/top10-scoring.md §7).
 *  임계(85%/75%)는 #103 정책을 그대로 재사용한다. */
const METRICS: Readonly<Record<OptimalZoneRole, string>> = {
  orchestrator: 'artificial_analysis_intelligence_index', worker: 'artificial_analysis_coding_index' };

export interface PlanOptimalEntry { readonly modelId: string; readonly displayName: string; readonly indexValue: number }
export interface PlanOptimalResult { readonly planId: string; readonly planName: string; readonly entries: readonly PlanOptimalEntry[];
  readonly bestIndexValue?: number }

const PLAN_OPTIMAL_LIMIT = 3;
const baseName = (id: string): string => normalizeModelName(splitBaseAndEffort(id).base);

function variantsFor(records: readonly Top10RecordInput[], metric: string, wanted?: ReadonlySet<string>): ModelVariant[] {
  return records
    .filter(r => r.metric === metric && Number.isFinite(r.value) && (!wanted || wanted.has(baseName(r.modelId))))
    .map(r => { const { base, effort } = splitBaseAndEffort(r.modelId);
      return { modelId: r.modelId, baseModelId: base, effort, value: r.value!,
        ...(r.priceInput !== undefined && r.priceOutput !== undefined &&
          { blendedCost: (3 * r.priceInput + r.priceOutput) / 4 }) }; });
}

/** 요금제 후보를 #103 필터(제외·최신만·off-peak) 같은 순서로 거른 뒤, **전체 최적 존 하한**(전체 후보
 *  최고값×85%/75%)을 그대로 적용한다(감사 fix-070-a). 통과가 없으면 빈 entries + 최고값만 남긴다. */
export function computePlanOptimal(records: readonly Top10RecordInput[], role: OptimalZoneRole,
  catalog: readonly PlanCatalogEntry[] = PLAN_CATALOG, nowUtc?: string): PlanOptimalResult[] {
  const metric = METRICS[role];
  const all = groupVariants(filterCandidates(variantsFor(records, metric), undefined, nowUtc));
  const cutoff = all.reduce((max, g) => Math.max(max, g.repVariant.value), 0) * OPTIMAL_ZONE_THRESHOLDS[role];
  const results: PlanOptimalResult[] = [];
  for (const plan of catalog) {
    const verified = plan.models.filter(m => m.verified);
    if (!verified.length) continue;
    const wanted = new Set(verified.map(m => baseName(m.modelId)));
    const groups = groupVariants(filterCandidates(variantsFor(records, metric, wanted), undefined, nowUtc));
    if (!groups.length) continue;
    const names = new Map(verified.map(m => [m.modelId, m.displayName]));
    const best = groups.reduce((max, g) => Math.max(max, g.repVariant.value), 0);
    const entries = groups.filter(g => g.repVariant.value >= cutoff)
      .sort((a, b) => b.repVariant.value - a.repVariant.value).slice(0, PLAN_OPTIMAL_LIMIT)
      .map(g => ({ modelId: g.baseModelId, displayName: names.get(normalizeModelName(g.baseModelId)) ?? g.baseModelId, indexValue: g.repVariant.value }));
    results.push({ planId: plan.planId, planName: plan.planName, entries, bestIndexValue: best });
  }
  return results;
}

/** 압축 렌더용 섹션 줄. 마크다운 렌더(agy1)도 이 export를 그대로 쓸 수 있다. */
export function renderPlanOptimalLines(records: readonly Top10RecordInput[], catalog: readonly PlanCatalogEntry[] = PLAN_CATALOG,
  nowUtc?: string): string[] {
  const orchestrator = computePlanOptimal(records, 'orchestrator', catalog, nowUtc);
  const worker = computePlanOptimal(records, 'worker', catalog, nowUtc);
  if (!orchestrator.length && !worker.length) return [];
  const lines = ['## 요금제상 최적'];
  for (const plan of new Set([...orchestrator, ...worker].map(r => r.planId))) {
    const parts: string[] = [];
    const o = orchestrator.find(r => r.planId === plan), w = worker.find(r => r.planId === plan);
    const part = (label: string, r: PlanOptimalResult | undefined) => {
      if (!r) return;
      parts.push(r.entries.length ? `${label} ${r.entries.map(e => `${e.displayName} ${e.indexValue.toFixed(1)}`).join(' > ')}`
        : `${label} 최적 존 해당 없음 · 최고 ${r.bestIndexValue?.toFixed(1) ?? '-'}`);
    };
    part('오케', o); part('워커', w);
    lines.push(`- ${(o ?? w)!.planName}: ${parts.join(' · ')}`);
  }
  lines.push('정액제는 추가 비용이 없어 지수 순으로 표시합니다(임계는 최적 존과 동일).');
  return lines;
}
