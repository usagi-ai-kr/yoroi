import { splitBaseAndEffort } from './letter-top10-group.js';
import { separateGptSolModels } from './letter-top10-filter.js';
import { activeLetterModelLists, banSetFor, listKeyOf } from './letter-model-lists.js';
import { FREE_ACCESS_METRIC, normalizeModelName, toRefMap, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
import { buildCandidatePool, plansForCatalogModel } from './letter-top10-candidates.js';
import { type OptimalZoneRole, type ScoreComponents, type ScoredGroup } from './letter-top10-worker.js';
import { scoreRoleCandidatesFromSources } from './letter-top10-score.js';
import { normalRankScores } from './letter-score-normal.js';
import { PLAN_CATALOG, type PlanCatalogEntry } from './plan-catalog.js';
import { loadEffortAvailability, resolveAvailability, UNCONSTRAINED_AVAILABILITY, type AvailabilityMode } from './letter-effort-availability.js';

export const TOP_N = 15;
export const SECTION_HEADINGS: Readonly<Record<OptimalZoneRole, string>> = {
  orchestrator: '## 🧭 오케스트레이터·리뷰어 Top10 (판단·계획·검토)', worker: '## 🛠️ 워커·메신저 Top10 (실행·코딩·전달)' };
export type RoleChange = '유지' | `▲${number}` | `▼${number}` | '진입' | '신규';
export interface RoleEntry {
  readonly rank: number; readonly modelId: string; readonly indexText: string; readonly repEffort: string;
  /** #188: 가용성 모드(capped=관측 상한, unverified=근사 보고, unlisted=프로필 밖)와 cap 무시 벤치마크 최적 effort. */
  readonly effortAvailability?: AvailabilityMode; readonly benchmarkEffort?: string;
  readonly blendedCostText: string; readonly scoreText?: string; readonly rawScore?: number;
  readonly scoreComponents?: ScoreComponents; readonly plans: readonly string[];
  readonly change: RoleChange; readonly isPareto: boolean; readonly both: boolean; readonly offPeak?: boolean;
  readonly belowZone?: boolean; readonly indexMissing?: boolean;
  readonly openrouterRankText?: string; readonly variantsText?: string; readonly successorOf?: string;
}
export interface RoleExit { readonly modelId: string; readonly previousRank: number }
export interface RoleList { readonly entries: readonly RoleEntry[]; readonly exits: readonly RoleExit[] }
export interface RoleLists { readonly orchestrator: RoleList; readonly worker: RoleList }

const costTextOf = (cost?: number): string => cost === undefined ? '단가 -' : cost === 0 ? '무료' : `$${cost.toFixed(2)}/1M`;
function buildList(records: readonly Top10RecordInput[], role: OptimalZoneRole, opts: Top10Options, catalog: readonly PlanCatalogEntry[], excluded: ReadonlySet<string>,
  scored: readonly ScoredGroup[], cal: ReadonlyMap<ScoredGroup, number>, allowOlder: readonly string[], benchmark?: ReadonlyMap<string, string>): RoleList {
  const successors = new Map<string, string>();
  for (const r of records) if (r.successorOf !== undefined && !separateGptSolModels(splitBaseAndEffort(r.modelId).base, splitBaseAndEffort(r.successorOf).base, allowOlder))
    successors.set(normalizeModelName(splitBaseAndEffort(r.modelId).base), r.successorOf);
  const selected = scored.filter(s => !excluded.has(listKeyOf(s.group.baseModelId))).slice(0, TOP_N);
  const entries = selected.map((s, i) => {
    const g = s.group, rep = g.repVariant, key = normalizeModelName(g.baseModelId), avail = resolveAvailability(g.baseModelId, opts?.effortAvailability);
    const or = (opts?.openrouterRecords ?? []).find(o => normalizeModelName(o.modelId) === key), orRank = or?.rank, bench = benchmark?.get(key);
    const vs = g.variants.length > 1 ? g.variants.slice(0, 3).map(v => `${v.effort} ${v.value.toFixed(1)}`).join(' · ') +
      (g.variants.length > 3 ? ` 외 ${g.variants.length - 3}개` : '') : undefined;
    const of = successors.get(key);
    return { rank: i + 1, modelId: g.baseModelId, indexText: rep.indexMissing ? '-' : rep.value.toFixed(1), repEffort: rep.effort,
      // p52: Free 경로도 원 API 단가(off-peak 포함)를 그대로 표시한다. 가격 결측 보정(0.99)은 단가 '-'로 둔다.
      blendedCostText: costTextOf(rep.effectiveCost ?? rep.blendedCost),
      scoreText: Number.isFinite(cal.get(s)) ? cal.get(s)!.toFixed(1) : '-', rawScore: s.score, scoreComponents: s.components,
      plans: plansForCatalogModel(g.baseModelId, catalog), isPareto: g.isPareto, both: false, effortAvailability: avail.mode,
      ...(bench !== undefined && bench !== rep.effort && { benchmarkEffort: bench }),
      ...(rep.indexMissing && { indexMissing: true }), ...(s.belowZone && { belowZone: true }),
      ...(rep.offPeak === true && { offPeak: true }),
      ...(typeof orRank === 'number' && Number.isSafeInteger(orRank) && orRank > 0 &&
        { openrouterRankText: `OpenRouter ${orRank}위` }),
      ...(vs !== undefined && { variantsText: vs }), ...(of !== undefined && { successorOf: of }) };
  });
  // 역할 행이 없는 전일 코호트(예: 전일 Cognition 누락으로 워커 보류)는 비교 불가로 보고 전부 진입 처리하지 않는다.
  const roleMap = opts?.previousCohort?.length ? toRefMap(opts.previousCohort, role) : null, prev = roleMap?.size ? roleMap : null,
    cur = new Set(entries.map(e => normalizeModelName(e.modelId)));
  const exits = prev ? [...prev].filter(([key, p]) => p <= TOP_N && !cur.has(key)).map(([modelId, previousRank]) => ({ modelId, previousRank }))
    .sort((a, b) => a.previousRank - b.previousRank) : [];
  return { entries: entries.map(e => {
    const p = prev?.get(normalizeModelName(e.modelId));
    const change: RoleChange = !prev ? '신규' : p === undefined || p > TOP_N ? '진입' : e.rank === p ? '유지' : e.rank < p ? `▲${p - e.rank}` : `▼${e.rank - p}`;
    return { ...e, change };
  }), exits };
}
const markBoth = (list: RoleList, other: ReadonlySet<string>): RoleList =>
  ({ ...list, entries: list.entries.map(e => ({ ...e, both: other.has(normalizeModelName(e.modelId)) })) });

/** 역할별 Top10: 중복 정리 후보 풀에서 존 통과 행을 먼저 놓고 부족분은 보충 점수순으로 채운다.
 *  교집합 모델은 두 목록에 모두 나오고(both=true), 전일 비교·이탈도 목록별로 재계산한다.
 *  AA 미측정 모델은 OpenRouter·OpenCode Data 근거 행이 있으면 후보 풀에 유지한다(unmeasured-evidence, 2026-10-13). */
export function computeRoleTop10(records: readonly Top10RecordInput[], opts?: Top10Options): RoleLists {
  // #188: 가용성 기본값은 여기서 한 번만 env 게이트로 해석한다. 현재 목록·previousRanks·두 렌더러가 같은 프로필을 쓴다.
  const av = opts?.effortAvailability ?? loadEffortAvailability(), input: Top10Options = { ...(opts ?? {}), ...(av && { effortAvailability: av }) };
  // p51: 런타임 free 카탈로그를 전체 후보에 합치고, 검증 free 경로 모델에는 접근 근거 표지 행만 넣는다(p52: 가격 불변).
  const base = input.catalog ?? PLAN_CATALOG, catalog = [...base, ...(input.freeCatalog ?? []).filter(f => !base.some(p => p.planId === f.planId))];
  const lists = input.letterModelLists ?? activeLetterModelLists(), excluded = new Set([...(input.excludeModelIds ?? [])].map(id => listKeyOf(splitBaseAndEffort(id).base)));
  const freeRows = catalog.filter(p => p.tier === 'free').flatMap(p => p.models.filter(m => m.verified).map(m => ({ modelId: m.modelId, metric: FREE_ACCESS_METRIC, value: 0 })));
  const evidence = [...(input.openrouterRecords ?? []), ...(input.opencodeDataRecords ?? []), ...(input.cognitionRecords ?? []), ...freeRows];
  const candidates = buildCandidatePool(records, catalog, evidence, lists).accessibleRecords;
  // p75: 오케 성능·사용량·속도, p85: 워커 성능·속도·가격+가산(사용량은 가산 입력), 역할별 가중치(ROLE_DIMENSION_WEIGHTS)·AA 지표. 두 계열 간 강제 배제 없음.
  // 점수 보정: 역할 선택자격 후 Top10 컷 전 대표 모집단 raw를 정규순위(50중심)로 1회 보정 — 표시 scoreText만 바꾸고 순위·▽존·representative·components는 raw 유지(▽ raw max×0.85/.60 원정책).
  const pick = (role: OptimalZoneRole) => {
    const scored = scoreRoleCandidatesFromSources(candidates, role, input), calibrated = normalRankScores(scored.map(s => s.score));
    const cal = new Map<ScoredGroup, number>(scored.map((s, i): [ScoredGroup, number] => [s, calibrated[i]!]));
    // #188: 벤치마크 이론값 = 같은 역할 점수 정책을 cap 없이 적용한 대표 effort다(AA 최고 관측값이 아니다).
    const uncapped = scoreRoleCandidatesFromSources(candidates, role, { ...input, effortAvailability: UNCONSTRAINED_AVAILABILITY });
    const benchmark = new Map(uncapped.map(s => [s.group.baseModelId, s.group.repVariant.effort] as const));
    return buildList(candidates, role, input, catalog, new Set([...excluded, ...banSetFor(lists, role)]), scored, cal, lists.allowOlder, benchmark);
  };
  const orchestrator = pick('orchestrator'), worker = pick('worker');
  const oKeys = new Set(orchestrator.entries.map(e => normalizeModelName(e.modelId))), wKeys = new Set(worker.entries.map(e => normalizeModelName(e.modelId)));
  return { orchestrator: markBoth(orchestrator, wKeys), worker: markBoth(worker, oKeys) };
}
/** 전일 비교용: 목록별 순위 맵. 접근 필터를 포함한 같은 존·정렬 정책으로 재계산한다. */
export function previousRanks(records: readonly Top10RecordInput[], opts?: Top10Options): Record<OptimalZoneRole, Map<string, number>> {
  const lists = computeRoleTop10(records, opts);
  const toMap = (list: RoleList): Map<string, number> => new Map(list.entries.map(e => [normalizeModelName(e.modelId), e.rank]));
  return { orchestrator: toMap(lists.orchestrator), worker: toMap(lists.worker) };
}
