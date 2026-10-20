import { buildVariants, type Top10Options, type Top10RecordInput } from '../insights/letter-top10-rank.js';
import { top10OptionsFrom, type Top10EvidenceInput } from '../insights/letter-top10-render-options.js';
import type { ModelVariant } from '../insights/letter-top10-group.js';
import { toReviewerCandidates, type ReviewerCandidate, type ReviewerCandidateExclusion } from '../insights/letter-reviewer-candidates.js';
import { applyReviewerPolicy } from '../insights/letter-reviewer-policy.js';
import { loadReviewerPolicy, type ReviewerDimensionWeights } from '../config/reviewer-policy.js';
import type { EffortAvailability } from '../insights/letter-effort-availability.js';

export const DEFAULT_REVIEWER_METRIC = 'artificial_analysis_intelligence_index';

export interface ReviewerCompositionInput extends Top10EvidenceInput {
  readonly records?: readonly Top10RecordInput[];
}

export interface ReviewerCompositionOptions {
  readonly metric?: string;
  readonly weights?: ReviewerDimensionWeights;
  readonly policyPath?: string;
  readonly top10Options?: Top10Options;
}

export interface ReviewerCompositionOutcome {
  readonly variants: readonly ModelVariant[];
  readonly candidates: readonly ReviewerCandidate[];
  readonly reviewer: readonly (ReviewerCandidate & { readonly score?: number })[];
  readonly excluded: readonly ReviewerCandidateExclusion[];
  readonly emptyCause?: string;
  readonly weights: ReviewerDimensionWeights;
}

/** Full-pool ModelVariant를 buildVariants로 구성하고 toReviewerCandidates에 넘겨
 *  리뷰어 3차원 정규화 증거 기반 가중합(50/20/30) 후보를 도출한다. Top10 절단 없음. */
export function buildReviewerCandidates(
  input?: ReviewerCompositionInput | null,
  options?: ReviewerCompositionOptions
): ReviewerCompositionOutcome {
  const metric = options?.metric ?? DEFAULT_REVIEWER_METRIC;
  const weights = options?.weights ?? loadReviewerPolicy(options?.policyPath).weights;
  const records = input?.records ?? [];
  if (records.length === 0) {
    return {
      variants: [],
      candidates: [],
      reviewer: [],
      excluded: [],
      emptyCause: 'no records available for reviewer candidate building',
      weights,
    };
  }
  const top10Opts = options?.top10Options ?? top10OptionsFrom(input ?? {});
  const variants = buildVariants(records, metric, top10Opts);
  const set = toReviewerCandidates(variants);
  const reviewer = applyReviewerPolicy(set.candidates, { weights });
  return {
    variants,
    candidates: set.candidates,
    reviewer,
    excluded: set.excluded,
    ...(set.emptyCause !== undefined && { emptyCause: set.emptyCause }),
    weights,
  };
}
