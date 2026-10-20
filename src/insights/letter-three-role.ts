import {
  selectRolesAlternating,
  type RoleCandidate,
  type SelectedRoleCandidate,
} from './letter-role-selection.js';

export type WeightClassifier<T extends RoleCandidate = RoleCandidate> =
  (modelId: string, candidate: T) => boolean | undefined;

export interface ThreeRoleAdapterInput<T extends RoleCandidate = RoleCandidate> {
  readonly orchestrator?: readonly T[];
  readonly reviewer?: readonly T[];
  readonly worker?: readonly T[];
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
  readonly top7: {
    readonly orchestrator: readonly SelectedRoleCandidate<T>[];
    readonly reviewer: readonly SelectedRoleCandidate<T>[];
    readonly worker: readonly SelectedRoleCandidate<T>[];
  };
  readonly top15: {
    readonly orchestrator: readonly SelectedRoleCandidate<T>[];
    readonly reviewer: readonly SelectedRoleCandidate<T>[];
    readonly worker: readonly SelectedRoleCandidate<T>[];
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
  const depth = typeof input.depth === 'number' && input.depth > 0 ? input.depth : 15;
  const res = selectRolesAlternating({ orchestrator: o, reviewer: r, worker: w, depth });
  const orchestrator = sliceRole(res.orchestrator), reviewer = sliceRole(res.reviewer), worker = sliceRole(res.worker);
  return {
    orchestrator, reviewer, worker,
    top7: { orchestrator: orchestrator.top7, reviewer: reviewer.top7, worker: worker.top7 },
    top15: { orchestrator: orchestrator.top15, reviewer: reviewer.top15, worker: worker.top15 },
    unconfirmedModels: res.unconfirmedModels,
  };
}
