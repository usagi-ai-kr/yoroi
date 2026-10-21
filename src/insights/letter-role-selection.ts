import { normalizeModelName } from './model-id.js';
import { splitBaseAndEffort } from './letter-top10-group.js';

export interface RoleCandidate {
  readonly modelId: string; readonly baseModelId?: string; readonly identityKey?: string;
  readonly score?: number; readonly weightOpen?: boolean; readonly unconfirmed?: boolean;
  readonly [key: string]: unknown;
}
export type SelectedRoleCandidate<T extends RoleCandidate> = T & {
  readonly rank: number; readonly originalRank: number; readonly identityKey: string;
  readonly isClosed: boolean; readonly unconfirmed: boolean; readonly weightOpen: boolean;
};
export interface RoleSelectionInput<T extends RoleCandidate = RoleCandidate> {
  readonly orchestrator?: readonly T[]; readonly reviewer?: readonly T[];
  readonly worker?: readonly T[]; readonly depth?: number;
}
export interface RoleSelectionResult<T extends RoleCandidate = RoleCandidate> {
  readonly orchestrator: readonly SelectedRoleCandidate<T>[];
  readonly reviewer: readonly SelectedRoleCandidate<T>[];
  readonly worker: readonly SelectedRoleCandidate<T>[];
  readonly depth: number; readonly unconfirmedModels: readonly string[];
}

export function resolveWeightClassification(candidate: RoleCandidate): {
  isClosed: boolean; unconfirmed: boolean; weightOpen: boolean;
} {
  if (candidate.unconfirmed === true || typeof candidate.weightOpen !== 'boolean') {
    return { isClosed: true, unconfirmed: true, weightOpen: false };
  }
  return { isClosed: !candidate.weightOpen, unconfirmed: false, weightOpen: candidate.weightOpen };
}

export function resolveIdentityKey(candidate: RoleCandidate): string {
  if (candidate.identityKey && candidate.identityKey.trim().length > 0) return normalizeModelName(candidate.identityKey.trim());
  const raw = candidate.baseModelId ?? (candidate.modelId ? splitBaseAndEffort(candidate.modelId).base : '');
  return normalizeModelName(raw).trim().replace(/^:+|:+$/g, '').trim();
}

/** #252: 역할별 독립 선발. 상대 역할과 무관하게 각 목록에서 identityKey 중복만 제거한다. */
function selectRole<T extends RoleCandidate>(candidates: readonly T[], depth: number, unconfirmed: Set<string>): SelectedRoleCandidate<T>[] {
  const selected: SelectedRoleCandidate<T>[] = [], seen = new Set<string>();
  for (let i = 0; i < candidates.length && selected.length < depth; i++) {
    const c = candidates[i]!, key = resolveIdentityKey(c);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const weight = resolveWeightClassification(c);
    if (weight.unconfirmed) unconfirmed.add(c.modelId);
    selected.push({ ...c, rank: selected.length + 1, originalRank: i + 1, identityKey: key, ...weight });
  }
  return selected;
}

export function selectRolesAlternating<T extends RoleCandidate>(input: RoleSelectionInput<T>): RoleSelectionResult<T> {
  const depth = typeof input.depth === 'number' && input.depth > 0 ? input.depth : 15;
  const unconfirmed = new Set<string>();
  return {
    orchestrator: selectRole(input.orchestrator ?? [], depth, unconfirmed),
    reviewer: selectRole(input.reviewer ?? [], depth, unconfirmed),
    worker: selectRole(input.worker ?? [], depth, unconfirmed), depth,
    unconfirmedModels: [...unconfirmed],
  };
}
