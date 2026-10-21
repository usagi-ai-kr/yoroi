import type { RoleCandidate } from './letter-role-selection.js';
import {
  selectThreeRoles,
  type ThreeRoleSelectionOutput,
  type WeightClassifier,
} from './letter-three-role.js';
import {
  renderThreeRoleMarkdown,
  renderThreeRoleSection,
} from './letter-three-role-render.js';
import {
  applyReviewerPolicy,
  type ReviewerPolicyConfig,
} from './letter-reviewer-policy.js';

export interface ThreeRoleSections {
  readonly orchestrator: string;
  readonly reviewer: string;
  readonly worker: string;
  readonly messenger?: string;
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
  readonly messenger?: readonly T[];
  readonly options?: ThreeRolePipelineOptions<T>;
}

export interface ThreeRolePipelineOutput<T extends RoleCandidate = RoleCandidate> {
  readonly enabled: boolean;
  readonly selection?: ThreeRoleSelectionOutput<T & { score?: number }>;
  /** #194 D: 컷·MECE 할당 전 전체 eligible reviewer(가중치 적용 후). Free 리뷰어 점수의 producer 값. */
  readonly reviewerPool?: readonly (T & { score?: number })[];
  readonly messengerPool?: readonly (T & { score?: number })[];
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

  const reviewer = applyReviewerPolicy(input.reviewer ?? [], opts.reviewerPolicy);
  const orchestrator = (input.orchestrator ?? []) as readonly (T & { score?: number })[];
  const worker = (input.worker ?? []) as readonly (T & { score?: number })[];
  const messenger = (input.messenger ?? []) as readonly (T & { score?: number })[];

  const selection = selectThreeRoles<T & { score?: number }>({
    orchestrator,
    reviewer,
    worker,
    messenger,
    ...(opts.classifier !== undefined && { classifier: opts.classifier }),
    depth,
  });

  const mAll = selection.messenger?.all ?? [];
  const sections: ThreeRoleSections = {
    orchestrator: renderThreeRoleSection('orchestrator', selection.orchestrator.all, renderDepth),
    reviewer: renderThreeRoleSection('reviewer', selection.reviewer.all, renderDepth),
    worker: renderThreeRoleSection('worker', selection.worker.all, renderDepth),
    ...(mAll.length > 0 && { messenger: renderThreeRoleSection('messenger', mAll, renderDepth) }),
  };

  const markdown = renderThreeRoleMarkdown({
    orchestrator: selection.orchestrator.all,
    reviewer: selection.reviewer.all,
    worker: selection.worker.all,
    messenger: mAll,
    depth: renderDepth,
    ...(opts.publicationDate !== undefined && { publicationDate: opts.publicationDate }),
  });

  return {
    enabled: true,
    selection,
    ...(reviewer.length > 0 && { reviewerPool: reviewer }),
    ...(messenger.length > 0 && { messengerPool: messenger }),
    markdown,
    sections,
  };
}
