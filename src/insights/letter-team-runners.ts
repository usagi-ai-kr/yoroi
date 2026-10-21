/** #257: 조합 차선(runners-up) — 같은 정책 풀에서 조합에 없는 역할별 최고 후보. */
import { resolveIdentityKey, type RoleCandidate } from './letter-role-selection.js';
import { canonicalModelId } from './model-display.js';

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

export interface RolePools { readonly o: readonly RoleCandidate[]; readonly r: readonly RoleCandidate[]; readonly w: readonly RoleCandidate[]; }
/** #261: Free 정책 후보 풀 — verified Free catalog 모델(Beam 포함)만, 역할별 측정 점수가 있으면 붙인다(없으면 미측정).
 *  Free catalog id(-free) 와 역할 목록 id(AA base) 는 canonical id 로 매칭하고, canonical 이 같으면 한 실체로 dedupe 한다.
 *  **미측정 Free 는 워커 fallback 으로만** 허용한다(오케·리뷰어 풀에는 측정 점수 있는 후보만). */
export function freePolicyPool(freeModelIds: readonly string[], lists: RolePools): TeamPlan {
  const unique: string[] = [], seen = new Set<string>();
  for (const id of freeModelIds) {
    const key = canonicalModelId(id);
    if (seen.has(key)) continue;
    seen.add(key); unique.push(id);
  }
  const pick = (list: readonly RoleCandidate[]): RoleCandidate[] => {
    const byKey = new Map(list.map(c => [canonicalModelId(c.modelId), c] as const));
    return unique.map(id => {
      const key = canonicalModelId(id), measured = byKey.get(key);
      return measured ? { ...measured, modelId: id, identityKey: key, free: true } : { modelId: id, identityKey: key, free: true };
    });
  };
  const measuredOnly = (list: readonly RoleCandidate[]): RoleCandidate[] => list.filter(c => c.score !== undefined);
  const o = sorted(measuredOnly(pick(lists.o))), r = sorted(measuredOnly(pick(lists.r))), w = sorted(pick(lists.w));
  return { o, r, w };
}
