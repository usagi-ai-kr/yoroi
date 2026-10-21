import {
  selectRolesAlternating,
  resolveIdentityKey,
  type RoleCandidate,
  type SelectedRoleCandidate,
} from './letter-role-selection.js';

export type WeightClassifier<T extends RoleCandidate = RoleCandidate> =
  (modelId: string, candidate: T) => boolean | undefined;

export interface ThreeRoleAdapterInput<T extends RoleCandidate = RoleCandidate> {
  readonly orchestrator?: readonly T[];
  readonly reviewer?: readonly T[];
  readonly worker?: readonly T[];
  /** U3a 메신저: MECE 교대 배정에 참여하지 않는 독립 목록(워커와 겹침 허용). */
  readonly messenger?: readonly T[];
  readonly classifier?: WeightClassifier<T>;
  readonly depth?: number;
}

export interface RoleSlices<T extends RoleCandidate = RoleCandidate> {
  readonly top7: readonly SelectedRoleCandidate<T>[];
  readonly top15: readonly SelectedRoleCandidate<T>[];
  readonly all: readonly SelectedRoleCandidate<T>[];
}

export interface ThreeRoleSelectionOutput<T extends RoleCandidate = RoleCandidate> {
  readonly orchestrator: RoleSlices<T>;
  readonly reviewer: RoleSlices<T>;
  readonly worker: RoleSlices<T>;
  /** U3a 메신저 독립 슬라이스(선택적 — 미소유 리터럴 호환). top7/top15 댓글 맵은 o/r/w 유지. */
  readonly messenger?: RoleSlices<T>;
  readonly top7: {
    readonly orchestrator: readonly SelectedRoleCandidate<T>[];
    readonly reviewer: readonly SelectedRoleCandidate<T>[];
    readonly worker: readonly SelectedRoleCandidate<T>[];
    /** U3b: 메신저 슬라이스(있을 때만). 4역할 댓글 조립이 사용한다. */
    readonly messenger?: readonly SelectedRoleCandidate<T>[];
  };
  readonly top15: {
    readonly orchestrator: readonly SelectedRoleCandidate<T>[];
    readonly reviewer: readonly SelectedRoleCandidate<T>[];
    readonly worker: readonly SelectedRoleCandidate<T>[];
    /** U3b: 메신저 Top15(있을 때만). 4역할 댓글 조립이 사용한다. */
    readonly messenger?: readonly SelectedRoleCandidate<T>[];
  };
  readonly unconfirmedModels: readonly string[];
}

function classifyList<T extends RoleCandidate>(list: readonly T[] | undefined, classifier?: WeightClassifier<T>): readonly T[] {
  if (!list) return [];
  if (!classifier) return list;
  return list.map(c => {
    const res = classifier(c.modelId, c);
    return res !== undefined ? { ...c, weightOpen: res } : c;
  });
}

const sliceRole = <T extends RoleCandidate>(items: readonly SelectedRoleCandidate<T>[]): RoleSlices<T> =>
  ({ top7: items.slice(0, 7), top15: items.slice(0, 15), all: items });

export function selectThreeRoles<T extends RoleCandidate = RoleCandidate>(input: ThreeRoleAdapterInput<T>): ThreeRoleSelectionOutput<T> {
  const o = classifyList(input.orchestrator, input.classifier);
  const r = classifyList(input.reviewer, input.classifier);
  const w = classifyList(input.worker, input.classifier);
  const m = classifyList(input.messenger, input.classifier);
  const depth = typeof input.depth === 'number' && input.depth > 0 ? input.depth : 15;
  const res = selectRolesAlternating({ orchestrator: o, reviewer: r, worker: w, depth });
  // 댓글 Top15 = 본문 Top7 접두 + 8위 이후 역할별 독립 후보(겹침 허용). sections/top7 MECE 유지.
  const rankExtras = <T extends RoleCandidate>(top7: readonly SelectedRoleCandidate<T>[], input: readonly T[]): readonly SelectedRoleCandidate<T>[] => {
    const seen = new Set(top7.map(c => resolveIdentityKey(c) || c.modelId));
    return [...input].sort((a, b) => ((b as { score?: number }).score ?? -1) - ((a as { score?: number }).score ?? -1))
      .filter(c => !seen.has(resolveIdentityKey(c) || c.modelId)).slice(0, Math.max(0, 15 - top7.length))
      .map((c, i) => ({ ...c, rank: top7.length + i + 1, originalRank: i + 1,
        identityKey: resolveIdentityKey(c) || c.modelId, isClosed: c.weightOpen !== true,
        unconfirmed: c.unconfirmed === true, weightOpen: c.weightOpen === true }));
  };
  const orchestrator = sliceRole(res.orchestrator), reviewer = sliceRole(res.reviewer), worker = sliceRole(res.worker);
  // U3a: 메신저는 MECE 밖 독립 정렬(점수 내림차순, 동점 입력순) — 워커와 같은 모델 허용.
  const mRanked = [...m].sort((a, b) => ((b as { score?: number }).score ?? -1) - ((a as { score?: number }).score ?? -1))
    .map((cc, i) => ({ ...cc, rank: i + 1, originalRank: i + 1, identityKey: resolveIdentityKey(cc) || cc.modelId,
      isClosed: cc.weightOpen !== true, unconfirmed: cc.unconfirmed === true, weightOpen: cc.weightOpen === true }));
  const messenger = sliceRole(mRanked);
  return {
    orchestrator, reviewer, worker, messenger,
    top7: { orchestrator: orchestrator.top7, reviewer: reviewer.top7, worker: worker.top7,
      ...(messenger.top7.length > 0 && { messenger: messenger.top7 }) },
    top15: { orchestrator: [...orchestrator.top7, ...rankExtras(orchestrator.top7, o)],
      reviewer: [...reviewer.top7, ...rankExtras(reviewer.top7, r)],
      worker: [...worker.top7, ...rankExtras(worker.top7, w)],
      ...(messenger.top15.length > 0 && { messenger: messenger.top15 }) },
    unconfirmedModels: res.unconfirmedModels,
  };
}
