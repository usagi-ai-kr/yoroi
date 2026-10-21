/** #257: 조합 차선(runners-up) — 같은 정책 풀에서 조합에 없는 역할별 최고 후보. */
import { resolveIdentityKey, type RoleCandidate } from './letter-role-selection.js';

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
