/** #257: 조합 차선(runners-up) — 같은 정책 풀에서 조합에 없는 역할별 최고 후보. */
import { resolveIdentityKey, type RoleCandidate } from './letter-role-selection.js';
import { canonicalModelId } from './model-display.js';
import { isCommonBanned } from './letter-model-lists.js';

export interface TeamPlan {
  readonly o: readonly RoleCandidate[]; readonly r: readonly RoleCandidate[]; readonly w: readonly RoleCandidate[];
}
export const keyOf = (c: RoleCandidate): string => resolveIdentityKey(c);
/** 점수 내림차순 → identityKey 오름차순(동점 결정론). 점수 없음은 -1로 꼴찌. */
export const sorted = (list: readonly RoleCandidate[]): readonly RoleCandidate[] =>
  [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || keyOf(a).localeCompare(keyOf(b)));

export type TeamRoleKey = 'orchestrator' | 'reviewer' | 'worker';
export interface RoleRunnersUp {
  readonly orchestrator?: RoleCandidate; readonly reviewer?: RoleCandidate; readonly worker?: RoleCandidate;
  /** 조합에 실제로 있는 역할(캡션 차선 대상). 1+2 는 리뷰어가 없다(#257). */
  readonly roles?: readonly TeamRoleKey[];
}
/** 역할별 최고 후보 중 조합에 없는 1개씩. 없으면 비어 둔다.
 *  roles 를 주면 **조합에 실제로 있는 역할만** 차선 후보를 낸다(#257: 1+2 는 리뷰어 차선 없음). */
export function runnersUp(pool: TeamPlan, picked: ReadonlySet<string>, roles?: readonly TeamRoleKey[]): RoleRunnersUp {
  const best = (list: readonly RoleCandidate[]): RoleCandidate | undefined =>
    sorted(list).find(c => !picked.has(keyOf(c)));
  const want = (role: TeamRoleKey): boolean => roles === undefined || roles.includes(role);
  const o = want('orchestrator') ? best(pool.o) : undefined;
  const r = want('reviewer') ? best(pool.r) : undefined;
  const w = want('worker') ? best(pool.w) : undefined;
  return { ...(roles !== undefined && { roles }), ...(o !== undefined && { orchestrator: o }),
    ...(r !== undefined && { reviewer: r }), ...(w !== undefined && { worker: w }) };
}

export interface RolePools { readonly o: readonly RoleCandidate[]; readonly r: readonly RoleCandidate[]; readonly w: readonly RoleCandidate[] }
/** #266-DELTA: verified Free 자격 — fallback 표시(free) 또는 canonical 키 매칭. */
export function isFreeCandidate(c: RoleCandidate, keys: ReadonlySet<string>): boolean { return ((c as { readonly free?: unknown }).free === true) || keys.has(canonicalModelId(c.modelId)) || keys.has(keyOf(c)); }
/** #266-DELTA: 워커 Free 쿼터. 키 없거나 비면 미적용. 측정 Free 우선, 없으면 미측정 fallback 허용(점수 생성 없음). */
export function freeWorkerNeed(pool: TeamPlan, keys?: ReadonlySet<string>): ((c: RoleCandidate) => boolean) | undefined {
  if (!keys?.size) return undefined;
  const frees = pool.w.filter(c => isFreeCandidate(c, keys));
  if (!frees.length) return () => false;
  const hasMeasured = frees.some(c => c.score !== undefined);
  return (c) => isFreeCandidate(c, keys) && (!hasMeasured || c.score !== undefined);
}
/** #266: 두 번째 정책 후보 풀 = **오픈 웨이트(레지스트리) ∪ verified Free**(Beam 포함) 합집합.
 *  canonical id 로 역할 목록의 측정 점수를 매칭하고, canonical 이 같으면 한 실체로 dedupe 한다.
 *  오케·리뷰어 풀에는 **측정 점수가 있는 후보만**(미측정은 워커 슬롯 전용). */
export function unionPool(modelIds: readonly string[], lists: RolePools, bannedKeys?: ReadonlySet<string>): TeamPlan {
  const unique: string[] = [], seen = new Set<string>();
  for (const id of modelIds) {
    if (bannedKeys?.size && isCommonBanned(id, bannedKeys)) continue; // 공통 blacklist: 풀 진입 차단
    const key = canonicalModelId(id);
    if (seen.has(key)) continue;
    seen.add(key); unique.push(id);
  }
  const pick = (list: readonly RoleCandidate[]): RoleCandidate[] => {
    const byKey = new Map(list.map(c => [canonicalModelId(c.modelId), c] as const));
    return unique.map(id => {
      const key = canonicalModelId(id), measured = byKey.get(key);
      return measured ? { ...measured, modelId: id, identityKey: key } : { modelId: id, identityKey: key };
    });
  };
  const measuredOnly = (list: readonly RoleCandidate[]): RoleCandidate[] => list.filter(c => c.score !== undefined);
  return { o: sorted(measuredOnly(pick(lists.o))), r: sorted(measuredOnly(pick(lists.r))), w: sorted(pick(lists.w)) };
}
