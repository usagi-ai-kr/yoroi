import type { RoleCandidate } from './letter-role-selection.js';
import { selectThreeRoles, type ThreeRoleSelectionOutput, type WeightClassifier } from './letter-three-role.js';
import { renderThreeRoleMarkdown, renderThreeRoleSection } from './letter-three-role-render.js';
import { applyReviewerPolicy, type ReviewerPolicyConfig } from './letter-reviewer-policy.js';
import { buildTeamCombinations, loadOpenWeightKeys } from './letter-team-combinations.js';
import { canonicalModelId } from './model-display.js';
import { commonBanSet, isCommonBanned } from './letter-model-lists.js';
import { unionPool } from './letter-team-runners.js';
import { combinationBadges, renderTeamMermaid, runnersUpCaption } from './letter-mermaid.js';

export interface ThreeRoleSections {
  readonly orchestrator: string;
  readonly reviewer: string;
  readonly worker: string;
  /** #253: 권장 조합 4개 Mermaid(워커 섹션 뒤·표시 안내 앞). 본문 전용. */
  readonly combinations?: readonly string[];
}

export interface ThreeRolePipelineOptions<T extends RoleCandidate = RoleCandidate> {
  readonly enabled?: boolean;
  readonly depth?: number;
  readonly publicationDate?: string;
  readonly classifier?: WeightClassifier<T>;
  readonly reviewerPolicy?: ReviewerPolicyConfig<T>;
}

export interface ThreeRolePipelineInput<T extends RoleCandidate = RoleCandidate> {
  readonly orchestrator?: readonly T[];
  readonly reviewer?: readonly T[];
  readonly worker?: readonly T[];
  /** 점수 없는 Free 워커 fallback({ modelId, free: true }). */
  readonly freeWorkerFallback?: readonly T[];
  /** #266: verified Free catalog 모델 id(합집합 후보에 포함). */
  readonly freeCatalogModelIds?: readonly string[];
  readonly options?: ThreeRolePipelineOptions<T>;
}

export interface ThreeRolePipelineOutput<T extends RoleCandidate = RoleCandidate> {
  readonly enabled: boolean;
  readonly selection?: ThreeRoleSelectionOutput<T & { score?: number }>;
  /** #194 D: 컷·MECE 할당 전 전체 eligible reviewer(가중치 적용 후). Free 리뷰어 점수의 producer 값. */
  readonly reviewerPool?: readonly (T & { score?: number })[];
  readonly markdown?: string;
  readonly sections?: ThreeRoleSections;
  readonly emptyCause?: string;
  readonly excluded?: readonly unknown[];
}

export function runThreeRolePipeline<T extends RoleCandidate = RoleCandidate>(
  input: ThreeRolePipelineInput<T>,
): ThreeRolePipelineOutput<T> {
  const opts = input.options;
  if (!opts || opts.enabled !== true) {
    return { enabled: false };
  }
  const depth = typeof opts.depth === 'number' && opts.depth > 0 ? opts.depth : 15;
  const renderDepth = opts.depth === 15 ? 15 : 7;

  const banned = commonBanSet();
  const reviewer = applyReviewerPolicy((input.reviewer ?? []).filter(c => !isCommonBanned(c.modelId, banned)), opts.reviewerPolicy);
  const orchestrator = ((input.orchestrator ?? []) as readonly (T & { score?: number })[]).filter(c => !isCommonBanned(c.modelId, banned));
  const worker = ((input.worker ?? []) as readonly (T & { score?: number })[]).filter(c => !isCommonBanned(c.modelId, banned));

  const selection = selectThreeRoles<T & { score?: number }>({
    orchestrator,
    reviewer,
    worker,
    ...(opts.classifier !== undefined && { classifier: opts.classifier }),
    depth,
  });

  // #253 조합 4개(선발·점수 무변경). #266 union 풀 + DELTA verified Free 워커 ≥1.
  const freeIds = (input.freeCatalogModelIds ?? []).filter(id => !isCommonBanned(id, banned)), unionIds = [...new Set([...loadOpenWeightKeys(), ...freeIds])];
  const top = { orchestrator: selection.orchestrator.top15, reviewer: selection.reviewer.top15, worker: selection.worker.top15 };
  const unionPlan = unionPool(unionIds, { o: top.orchestrator, r: top.reviewer, w: top.worker }, banned);
  const combinations = buildTeamCombinations({ top15: top, verifiedFreeKeys: new Set(freeIds.map(canonicalModelId)), bannedKeys: banned, ...(input.freeWorkerFallback !== undefined && { freeWorkerFallback: input.freeWorkerFallback }), unionPool: unionPlan })
    .map(combination => `**${combination.label}** ${combinationBadges(combination)}\n\n${renderTeamMermaid(combination)}\n\n${runnersUpCaption(combination.runnersUp)}`);
  const sections: ThreeRoleSections = {
    orchestrator: renderThreeRoleSection('orchestrator', selection.orchestrator.all, renderDepth),
    reviewer: renderThreeRoleSection('reviewer', selection.reviewer.all, renderDepth),
    worker: renderThreeRoleSection('worker', selection.worker.all, renderDepth),
    ...(combinations.length > 0 && { combinations }),
  };

  const markdown = renderThreeRoleMarkdown({
    orchestrator: selection.orchestrator.all,
    reviewer: selection.reviewer.all,
    worker: selection.worker.all,
    depth: renderDepth,
    ...(opts.publicationDate !== undefined && { publicationDate: opts.publicationDate }),
  });

  return {
    enabled: true,
    selection,
    ...(reviewer.length > 0 && { reviewerPool: reviewer }),
    markdown,
    sections,
  };
}
