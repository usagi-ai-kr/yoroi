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
  readonly options?: ThreeRolePipelineOptions<T>;
}

export interface ThreeRolePipelineOutput<T extends RoleCandidate = RoleCandidate> {
  readonly enabled: boolean;
  readonly selection?: ThreeRoleSelectionOutput<T & { score?: number }>;
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

  const selection = selectThreeRoles<T & { score?: number }>({
    orchestrator,
    reviewer,
    worker,
    ...(opts.classifier !== undefined && { classifier: opts.classifier }),
    depth,
  });

  const sections: ThreeRoleSections = {
    orchestrator: renderThreeRoleSection('orchestrator', selection.orchestrator.all, renderDepth),
    reviewer: renderThreeRoleSection('reviewer', selection.reviewer.all, renderDepth),
    worker: renderThreeRoleSection('worker', selection.worker.all, renderDepth),
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
    markdown,
    sections,
  };
}
