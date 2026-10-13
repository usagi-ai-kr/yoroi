import { groupVariants, splitBaseAndEffort, type ModelGroup } from './letter-top10-group.js';
import { normalizeModelName, toRefMap, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
import { buildCandidatePool, buildRoleVariants, plansForCatalogModel } from './letter-top10-candidates.js';
import { selectRoleCandidates, type OptimalZoneRole, type ScoreComponents } from './letter-top10-worker.js';
import { PLAN_CATALOG } from './plan-catalog.js';
import type { PlanCatalogEntry } from './plan-catalog.js';

/** 후보 지표: 오케스트레이터=intelligence, 워커=coding. 임계 상수는 letter-top10-worker의 OPTIMAL_ZONE_THRESHOLDS. */
const METRICS: Readonly<Record<OptimalZoneRole, string>> = {
  orchestrator: 'artificial_analysis_intelligence_index', worker: 'artificial_analysis_coding_index' };
export const TOP_N = 10;
export const SECTION_HEADINGS: Readonly<Record<OptimalZoneRole, string>> = {
  orchestrator: '## 🧭 오케스트레이터 Top10 (판단·계획 / Intelligence Index)',
  worker: '## 🛠️ 워커 Top10 (실행·코딩 / Coding Index)' };
export type RoleChange = '유지' | `▲${number}` | `▼${number}` | '진입' | '신규';
export interface RoleEntry {
  readonly rank: number; readonly modelId: string; readonly indexText: string; readonly repEffort: string;
  readonly blendedCostText: string; readonly costEffRankText: string; readonly scoreText?: string;
  readonly scoreComponents?: ScoreComponents; readonly plans: readonly string[];
  readonly change: RoleChange; readonly isPareto: boolean; readonly both: boolean; readonly offPeak?: boolean;
  readonly belowZone?: boolean; readonly indexMissing?: boolean;
  readonly openrouterRankText?: string; readonly variantsText?: string;
  readonly successorOf?: string;
}
export interface RoleExit { readonly modelId: string; readonly previousRank: number }
export interface RoleList { readonly entries: readonly RoleEntry[]; readonly exits: readonly RoleExit[] }
export interface RoleLists { readonly orchestrator: RoleList; readonly worker: RoleList }

const costTextOf = (cost?: number): string => cost === undefined ? '단가 -' : cost === 0 ? '무료' : `$${cost.toFixed(2)}/1M`;
/** 같은 후보 풀(제외·최신만·off-peak → 단가 → 후속 하한 → 보유 요금제 접근)에서 역할 지표만 다시 군집화한다. */
const zoneGroups = (records: readonly Top10RecordInput[], role: OptimalZoneRole, opts?: Top10Options): ModelGroup[] =>
  groupVariants(buildRoleVariants(records, METRICS[role], opts));

function buildList(records: readonly Top10RecordInput[], role: OptimalZoneRole, opts: Top10Options, catalog: readonly PlanCatalogEntry[], excluded: ReadonlySet<string>): RoleList {
  const successors = new Map<string, string>();
  for (const r of records) if (r.successorOf !== undefined) successors.set(normalizeModelName(r.modelId), r.successorOf);
  const selected = selectRoleCandidates(zoneGroups(records, role, opts), role, Number.MAX_SAFE_INTEGER)
    .filter(s => !excluded.has(normalizeModelName(s.group.baseModelId))).slice(0, TOP_N);
  const entries = selected.map((s, i) => {
    const g = s.group, rep = g.repVariant, key = normalizeModelName(g.baseModelId);
    const or = (opts?.openrouterRecords ?? []).find(o => normalizeModelName(o.modelId) === key);
    const orRank = or?.rank;
    const vs = g.variants.length > 1 ? g.variants.slice(0, 3).map(v => `${v.effort} ${v.value.toFixed(1)}`).join(' · ') +
      (g.variants.length > 3 ? ` 외 ${g.variants.length - 3}개` : '') : undefined;
    const of = successors.get(key);
    return { rank: i + 1, modelId: g.baseModelId, indexText: rep.indexMissing ? '-' : rep.value.toFixed(1), repEffort: rep.effort,
      blendedCostText: costTextOf(rep.effectiveCost ?? rep.blendedCost),
      costEffRankText: s.costEffRank === 0 ? '가성비 n/a' : `가성비 ${s.costEffRank}위`,
      scoreText: s.score.toFixed(1), scoreComponents: s.components,
      plans: plansForCatalogModel(g.baseModelId, catalog), isPareto: g.isPareto, both: false,
      ...(rep.indexMissing && { indexMissing: true }), ...(s.belowZone && { belowZone: true }),
      ...(rep.offPeak === true && { offPeak: true }),
      ...(typeof orRank === 'number' && Number.isSafeInteger(orRank) && orRank > 0 &&
        { openrouterRankText: `OpenRouter ${orRank}위` }),
      ...(vs !== undefined && { variantsText: vs }), ...(of !== undefined && { successorOf: of }) };
  });
  const prev = opts?.previousCohort?.length ? toRefMap(opts.previousCohort, role) : null;
  const cur = new Set(entries.map(e => normalizeModelName(e.modelId)));
  const exits = prev ? [...prev].filter(([key, p]) => p <= TOP_N && !cur.has(key))
    .map(([modelId, previousRank]) => ({ modelId, previousRank })).sort((a, b) => a.previousRank - b.previousRank) : [];
  return { entries: entries.map(e => {
    const p = prev?.get(normalizeModelName(e.modelId));
    const change: RoleChange = !prev ? '신규' : p === undefined || p > TOP_N ? '진입'
      : e.rank === p ? '유지' : e.rank < p ? `▲${p - e.rank}` : `▼${e.rank - p}`;
    return { ...e, change };
  }), exits };
}
const markBoth = (list: RoleList, other: ReadonlySet<string>): RoleList =>
  ({ ...list, entries: list.entries.map(e => ({ ...e, both: other.has(normalizeModelName(e.modelId)) })) });

/** 역할별 Top10: 중복 정리 후보 풀에서 존 통과 행을 먼저 놓고 부족분은 보충 점수순으로 채운다.
 *  교집합 모델은 두 목록에 모두 나오고(both=true), 전일 비교·이탈도 목록별로 재계산한다.
 *  AA 미측정 모델은 OpenRouter·OpenCode Data 근거 행이 있으면 후보 풀에 유지한다(unmeasured-evidence, 2026-10-13). */
export function computeRoleTop10(records: readonly Top10RecordInput[], opts?: Top10Options): RoleLists {
  const catalog = opts?.catalog ?? PLAN_CATALOG, excluded = new Set([...(opts?.excludeModelIds ?? [])]
    .map(id => normalizeModelName(splitBaseAndEffort(id).base)));
  const evidence = [...(opts?.openrouterRecords ?? []), ...(opts?.opencodeDataRecords ?? [])];
  const candidates = buildCandidatePool(records, catalog, evidence).accessibleRecords;
  const orchestrator = buildList(candidates, 'orchestrator', opts ?? {}, catalog, excluded), worker = buildList(candidates, 'worker', opts ?? {}, catalog, excluded);
  const oKeys = new Set(orchestrator.entries.map(e => normalizeModelName(e.modelId)));
  const wKeys = new Set(worker.entries.map(e => normalizeModelName(e.modelId)));
  return { orchestrator: markBoth(orchestrator, wKeys), worker: markBoth(worker, oKeys) };
}
/** 전일 비교용: 목록별 순위 맵. 접근 필터를 포함한 같은 존·정렬 정책으로 재계산한다. */
export function previousRanks(records: readonly Top10RecordInput[], opts?: Top10Options): Record<OptimalZoneRole, Map<string, number>> {
  const lists = computeRoleTop10(records, opts);
  const toMap = (list: RoleList): Map<string, number> =>
    new Map(list.entries.map(e => [normalizeModelName(e.modelId), e.rank]));
  return { orchestrator: toMap(lists.orchestrator), worker: toMap(lists.worker) };
}
