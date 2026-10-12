import { groupVariants, type ModelGroup } from './letter-top10-group.js';
import { plansForModel } from './letter-top10-plans.js';
import { buildVariants, normalizeModelName, toRefMap, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
import { OPTIMAL_ZONE_THRESHOLDS, type OptimalZoneRole } from './letter-top10-worker.js';

const METRICS: Readonly<Record<OptimalZoneRole, string>> = { orchestrator: 'artificial_analysis_intelligence_index', worker: 'artificial_analysis_coding_index' };
export const UNIFIED_TOP_N = 10;
export type UnifiedChange = '유지' | `▲${number}` | `▼${number}` | '진입' | '신규';
export interface UnifiedEntry {
  readonly rank: number; readonly modelId: string; readonly roles: readonly OptimalZoneRole[]; readonly roleLabel: string;
  readonly indexText: string; readonly repEffort: string; readonly blendedCostText: string; readonly costEffRankText: string;
  readonly plans: readonly string[]; readonly change: UnifiedChange; readonly isPareto: boolean; readonly offPeak?: boolean;
  readonly arenaRankText?: string; readonly openrouterRankText?: string; readonly variantsText?: string; readonly successorOf?: string;
}
export interface UnifiedExit { readonly modelId: string; readonly previousRank: number }
export interface UnifiedResult { readonly entries: readonly UnifiedEntry[]; readonly exits: readonly UnifiedExit[] }
interface Pass { readonly role: OptimalZoneRole; readonly group: ModelGroup; readonly value: number }
interface Row { readonly key: string; readonly list: readonly Pass[]; readonly plans: readonly string[]; readonly rep: ModelGroup; readonly successorOf?: string }
const ROLE_LABEL: Readonly<Record<OptimalZoneRole, string>> = { orchestrator: '🧭 오케', worker: '🛠️ 워커' };
const successorOfOf = (row: Top10RecordInput): string | undefined => row.successorOf;
const costTextOf = (cost?: number): string => cost === undefined ? '단가 -' : cost === 0 ? '무료' : `$${cost.toFixed(2)}/1M`;
const tierOf = (cost?: number): number => cost === undefined ? 2 : cost === 0 ? 0 : 1;
const best = (list: readonly Pass[], pick: (p: Pass) => number | undefined): number => Math.max(...list.map(p => pick(p) ?? Number.NEGATIVE_INFINITY));
const repOf = (list: readonly Pass[]): ModelGroup => (list.find(p => p.role === 'orchestrator') ?? list[0]!).group;
/** 정렬: 단가 tier → 가성비 중 큰 값 → OR 사용량 → 속도 → 지수(전부 내림/오름 규칙은 best 부호로 표현). */
const sortRows = <T extends { key: string; list: readonly Pass[]; rep: ModelGroup }>(rows: T[]): T[] =>
  rows.sort((a, b) => tierOf(a.rep.repVariant.blendedCost) - tierOf(b.rep.repVariant.blendedCost) ||
    best(b.list, p => p.group.repVariant.costEfficiency) - best(a.list, p => p.group.repVariant.costEfficiency) ||
    best(b.list, p => p.group.repVariant.openrouterTokens) - best(a.list, p => p.group.repVariant.openrouterTokens) ||
    best(b.list, p => p.group.repVariant.outputTokensPerSecond) - best(a.list, p => p.group.repVariant.outputTokensPerSecond) ||
    best(b.list, p => p.value) - best(a.list, p => p.value) || a.key.localeCompare(b.key));

function zonePasses(records: readonly Top10RecordInput[], opts?: Top10Options): Map<string, Pass[]> {
  const passes = new Map<string, Pass[]>();
  for (const role of ['orchestrator', 'worker'] as const) {
    const groups = groupVariants(buildVariants(records, METRICS[role], opts))
      .filter(g => plansForModel(g.baseModelId).length > 0); // 접근 불가 모델은 임계 기준에서도 제외
    if (!groups.length) continue;
    const cutoff = Math.max(...groups.map(g => g.repVariant.value)) * OPTIMAL_ZONE_THRESHOLDS[role];
    for (const group of groups) {
      if (group.repVariant.value < cutoff) continue;
      const key = normalizeModelName(group.baseModelId);
      passes.set(key, [...(passes.get(key) ?? []), { role, group, value: group.repVariant.value }]);
    }
  }
  return passes;
}
function toRows(records: readonly Top10RecordInput[], opts?: Top10Options): readonly Row[] {
  const successorOf = new Map<string, string>();
  for (const r of records) { const of = successorOfOf(r); if (of !== undefined) successorOf.set(normalizeModelName(r.modelId), of); }
  return sortRows([...zonePasses(records, opts).entries()].flatMap(([key, list]) => {
    const plans = [...new Set(list.flatMap(p => plansForModel(p.group.baseModelId)))];
    if (!plans.length) return [];
    const of = successorOf.get(key);
    return [{ key, list, plans, rep: repOf(list), ...(of !== undefined && { successorOf: of }) }];
  }));
}
/** 존 통과 키만(접근 필터 전) — 테스트·진단용. */
export const computeZonePasses = (records: readonly Top10RecordInput[], opts?: Top10Options): Map<string, Pass[]> =>
  zonePasses(records, opts);

/** 통합 Top10: 모델이 오케스트레이터 존(지능 ≥ 후보 최고 85%)·워커 존(코딩 ≥ 후보 최고 75%) 중
 *  통과한 역할로 추천 역할을 붙이고, 한 곳도 못 통과하거나 보유 요금제로 접근 불가하면 제외한다.
 *  정렬: 가성비 중 큰 값 → OR 사용량 → 속도 → 지수. 전일 비교도 같은 정책으로 재계산한다. */
export function computeUnifiedTop10(records: readonly Top10RecordInput[], opts?: Top10Options): UnifiedResult {
  const rows = toRows(records, opts).slice(0, UNIFIED_TOP_N);
  let rank = 0, seen = 0, previousEff = Number.NaN;
  const entries = rows.map(row => {
    const eff = best(row.list, p => p.group.repVariant.costEfficiency);
    seen += 1;
    if (eff !== previousEff) { rank = seen; previousEff = eff; }
    const rep = row.rep.repVariant, roles = row.list.map(p => p.role);
    const orRank = (opts?.openrouterRecords ?? []).find(o => normalizeModelName(o.modelId) === row.key);
    const vText = row.rep.variants.length > 1 ? row.rep.variants.slice(0, 3).map(v => `${v.effort} ${v.value.toFixed(1)}`).join(' · ') +
      (row.rep.variants.length > 3 ? ` 외 ${row.rep.variants.length - 3}개` : '') : undefined;
    return { rank, modelId: row.rep.baseModelId, roles, roleLabel: roles.length > 1 ? '🧭+🛠️ 둘 다' : ROLE_LABEL[roles[0]!]!,
      indexText: row.list.map(p => `${p.role === 'orchestrator' ? '오케' : '워커'} ${p.value.toFixed(1)}`).join(' · '),
      repEffort: rep.effort, blendedCostText: costTextOf(rep.blendedCost),
      costEffRankText: rep.costEfficiency === undefined ? '가성비 n/a' : `가성비 ${rank}위`, plans: row.plans,
      isPareto: row.list.some(p => p.group.isPareto), ...(row.list.some(p => p.group.repVariant.offPeak === true) && { offPeak: true }),
      ...(rep.arenaRank !== undefined && { arenaRankText: `Arena ${rep.arenaRank}위` }),
      ...(orRank !== undefined && { openrouterRankText: `OpenRouter ${orRank.rank ?? orRank.value}위` }),
      ...(vText !== undefined && { variantsText: vText }), ...(row.successorOf !== undefined && { successorOf: row.successorOf }) };
  });
  const prev = opts?.previousCohort?.length ? toRefMap(opts.previousCohort) : null;
  const curKeys = new Set(entries.map(e => normalizeModelName(e.modelId)));
  const exits = prev ? [...prev].filter(([key, pRank]) => pRank <= UNIFIED_TOP_N && !curKeys.has(key))
    .map(([key, previousRank]) => ({ modelId: key, previousRank })).sort((a, b) => a.previousRank - b.previousRank) : [];
  return { entries: entries.map(e => {
    const pRank = prev?.get(normalizeModelName(e.modelId));
    const change: UnifiedChange = !prev ? '신규' : pRank === undefined || pRank > UNIFIED_TOP_N ? '진입' :
      e.rank === pRank ? '유지' : e.rank < pRank ? `▲${pRank - e.rank}` : `▼${e.rank - pRank}`;
    return { ...e, change };
  }), exits };
}
/** 전일 비교용: 접근 필터를 포함한 같은 존·정렬 정책으로 전일 순위를 계산한다. */
export function previousRanks(records: readonly Top10RecordInput[], opts?: Top10Options): Map<string, number> {
  const rows = toRows(records, opts).slice(0, UNIFIED_TOP_N);
  return new Map(rows.map((row, idx) => [row.key, idx + 1]));
}
