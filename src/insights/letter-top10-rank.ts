import { normalizeModelName } from './model-id.js';
export { normalizeModelName } from './model-id.js';
import type { LetterModelLists } from './letter-model-lists.js';
import { splitBaseAndEffort, effortForModel, calcBlendedCost, calcCostEfficiency, type ModelVariant } from './letter-top10-group.js';
import { filterCandidates } from './letter-top10-filter.js';
import type { OffPeakRate } from './model-price-overrides.js';
import type { PlanCatalogEntry } from './plan-catalog.js';

export interface Top10RecordInput { readonly modelId: string; readonly modelAlias?: string; readonly value?: number; readonly metric?: string; readonly rank?: number; readonly priceInput?: number;
  readonly priceOutput?: number; readonly successorOf?: string; readonly releaseDate?: string }
export interface Top10Options { readonly openrouterRecords?: readonly Top10RecordInput[]; readonly previousCohort?: readonly Top10RecordInput[] | null;
  readonly priceOverrides?: Readonly<Record<string, OffPeakRate>>; readonly nowUtc?: string;
  readonly catalog?: readonly PlanCatalogEntry[]; readonly excludeModelIds?: ReadonlySet<string>;
  readonly letterModelLists?: LetterModelLists;
  readonly opencodeDataRecords?: readonly Top10RecordInput[];
  /** Cognition main subset만. modelId는 정규화 base+effort 접미사. metric: `cognition_correct`(정답률 0..1)·
   *  `cognition_cost`(USD/task)·`cognition_duration_min`(분/task). p51 4차원 점수의 성능·가격·속도 근거. */
  readonly cognitionRecords?: readonly Top10RecordInput[];
  /** p51: 런타임 검증 free 카탈로그(tier 'free'). 전체 Top10 후보 풀에 합친다(p52: 접근 근거일 뿐 가격 불변). */
  readonly freeCatalog?: readonly PlanCatalogEntry[] }
/** Cognition main 근거 지표: 정답률(ratio)·작업당 비용(USD/task)·작업당 소요 시간(분). */
export const COGNITION_METRIC = 'cognition_correct', COGNITION_COST_METRIC = 'cognition_cost', COGNITION_DURATION_METRIC = 'cognition_duration_min';
/** p51: 검증 free 카탈로그 경로 표지 행(값은 의미 없음, 가격 아님). 후보 풀에서 접근 근거 행으로만 다룬다. */
export const FREE_ACCESS_METRIC = 'verified_free_access';
const SPEED_METRIC = 'median_output_tokens_per_second';
const COST_PER_TASK_METRIC = 'intelligence_index_cost_per_task';
export function effortCostMultiplier(costPerTask?: number, baseCostPerTask?: number): number {
  return Number.isFinite(costPerTask) && Number.isFinite(baseCostPerTask) && (baseCostPerTask ?? 0) > 0
    ? costPerTask! / baseCostPerTask! : 1;
}
const variantKey = (r: Top10RecordInput): string => {
  const { base } = splitBaseAndEffort(r.modelId);
  return `${normalizeModelName(base)}|${effortForModel(r.modelId, r.modelAlias)}`;
};
export function assignCompetitionRanks<T extends { value?: number; modelId: string }>(items: readonly T[]): { item: T; rank: number }[] {
  const sorted = [...items].sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.modelId.localeCompare(b.modelId)); let rank = 1;
  return sorted.map((item, idx) => {
    if (idx > 0 && (item.value ?? 0) < (sorted[idx - 1]!.value ?? 0)) rank = idx + 1;
    return { item, rank };
  });
}
export function toRefMap(records?: readonly Top10RecordInput[] | null, metric?: string): Map<string, number> {
  const map = new Map<string, number>(), owner = new Map<string, string>(), amb = new Set<string>();
  const put = (rawId: string, rank: number) => {
    const norm = normalizeModelName(rawId), prev = owner.get(norm);
    if (prev !== undefined && prev !== rawId) { amb.add(norm); return; }
    owner.set(norm, rawId); if (!map.has(norm)) map.set(norm, rank);
  };
  if (!records?.length) return map;
  const scoped = records.filter(r => !metric || !r.metric || r.metric === metric || r.metric === 'rank');
  const ranked = scoped.filter(r => Number.isSafeInteger(r.rank) && (r.rank ?? 0) > 0);
  if (ranked.length) for (const r of ranked) put(r.modelId, r.rank!);
  else for (const { item, rank } of assignCompetitionRanks(scoped.filter(r => Number.isFinite(r.value)))) put(item.modelId, rank);
  for (const n of amb) map.delete(n);
  return map;
}
/** 완전한 공식 순위 집합은 보존하고, 혼합·누락 순위 집합은 사용량순 ordinal로 통일한다. */
export function toRankedRecords(records: readonly Top10RecordInput[]): readonly Top10RecordInput[] {
  if (!records.length || records.every(r => Number.isSafeInteger(r.rank) && (r.rank ?? 0) > 0)) return records;
  const usage = (r: Top10RecordInput): number => Number.isFinite(r.value) ? r.value! : Number.NEGATIVE_INFINITY;
  return [...records].sort((a, b) => usage(b) - usage(a) || a.modelId.localeCompare(b.modelId))
    .map((r, index) => ({ ...r, rank: index + 1 }));
}
/** 지표 행을 variants로 만들고 제외 계열(Fable·Astra)·최신 버전만·off-peak 단가 규칙을 적용한다. */
export function buildVariants(records: readonly Top10RecordInput[], metric: string, opts?: Top10Options): ModelVariant[] {
  const orMap = toRefMap(opts?.openrouterRecords, 'total_tokens');
  const speedMap = new Map(records.filter(r => r.metric === SPEED_METRIC && Number.isFinite(r.value)).map(r => [normalizeModelName(r.modelId), r.value!]));
  const taskCosts = new Map(records.filter(r => r.metric === COST_PER_TASK_METRIC && Number.isFinite(r.value)).map(r => [variantKey(r), r.value!]));
  const baseCosts = new Map(records.filter(r => r.metric === COST_PER_TASK_METRIC && splitBaseAndEffort(r.modelId).effort === 'default' && Number.isFinite(r.value))
    .map(r => [normalizeModelName(splitBaseAndEffort(r.modelId).base), r.value!]));
  return filterCandidates(records.filter(r => (!r.metric || r.metric === metric) && Number.isFinite(r.value)).map(r => {
    const { base } = splitBaseAndEffort(r.modelId), effort = effortForModel(r.modelId, r.modelAlias);
    const cost = calcBlendedCost(r.priceInput, r.priceOutput), taskCost = taskCosts.get(variantKey(r));
    const multiplier = effortCostMultiplier(taskCost, baseCosts.get(normalizeModelName(base)));
    const effectiveCost = cost === undefined ? undefined : cost * multiplier;
    const eff = calcCostEfficiency(r.value!, effectiveCost);
    const orTokens = opts?.openrouterRecords?.find(o => normalizeModelName(o.modelId) === normalizeModelName(r.modelId) ||
      normalizeModelName(o.modelId) === normalizeModelName(base))?.value;
    const ocTokens = opts?.opencodeDataRecords?.find(o => normalizeModelName(o.modelId) === normalizeModelName(r.modelId) ||
      normalizeModelName(o.modelId) === normalizeModelName(base))?.value;
    const speed = speedMap.get(normalizeModelName(r.modelId));
    return { modelId: r.modelId, baseModelId: base, effort, value: r.value!, ...(cost !== undefined && { blendedCost: cost }),
      ...(taskCost !== undefined && { costPerTask: taskCost }), ...(effectiveCost !== undefined && { effectiveCost }),
      ...(eff !== undefined && { costEfficiency: eff }), ...(orTokens !== undefined && { openrouterTokens: orTokens }),
      ...(ocTokens !== undefined && { opencodeTokens: ocTokens }),
      ...(speed !== undefined && { outputTokensPerSecond: speed }) };
  }), opts?.priceOverrides, opts?.nowUtc);
}
