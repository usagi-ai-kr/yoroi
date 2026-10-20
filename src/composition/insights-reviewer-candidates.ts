import { buildVariants, type Top10Options, type Top10RecordInput } from '../insights/letter-top10-rank.js';
import { top10OptionsFrom, type Top10EvidenceInput } from '../insights/letter-top10-render-options.js';
import type { ModelVariant } from '../insights/letter-top10-group.js';
import { toReviewerCandidates, type ReviewerCandidate, type ReviewerCandidateExclusion } from '../insights/letter-reviewer-candidates.js';
import { buildCandidatePool } from '../insights/letter-top10-candidates.js';
import { PLAN_CATALOG } from '../insights/plan-catalog.js';
import { activeLetterModelLists } from '../insights/letter-model-lists.js';
import { applyReviewerPolicy } from '../insights/letter-reviewer-policy.js';
import { loadReviewerPolicy, type ReviewerDimensionWeights } from '../config/reviewer-policy.js';
import { capOfModel, effortWithinCap } from '../insights/letter-effort-availability.js';
import { normalizeModelName } from '../insights/letter-top10-rank.js';
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
  // 접근 가능 카탈로그 제한: top10Opts의 catalog + freeCatalog을 모두 쓰고 evidence도 전달한다.
  // 보유 플랜에 없는 AA 전용 모델 등을 제외한다.
  const poolBase = top10Opts.catalog ?? PLAN_CATALOG;
  const poolCatalog = [...poolBase, ...(top10Opts.freeCatalog ?? []).filter(f => !poolBase.some(p => p.planId === f.planId))];
  const poolEvidence = [...(top10Opts.openrouterRecords ?? []), ...(top10Opts.opencodeDataRecords ?? []), ...(top10Opts.cognitionRecords ?? [])];
  const poolLists = top10Opts.letterModelLists ?? activeLetterModelLists();
  const accessible = new Set(buildCandidatePool(records, poolCatalog, poolEvidence, poolLists).accessibleRecords.map(r => normalizeModelName(r.modelId)));
  const reachable = variants.filter(v => accessible.has(normalizeModelName(v.modelId)) || accessible.has(normalizeModelName(v.baseModelId)));
  const gone = variants.filter(v => !reachable.includes(v))
    .map(v => ({ modelId: v.modelId, missing: [] as const, reason: 'inaccessible-catalog' }));
  const set = toReviewerCandidates(reachable);
  // effort cap: 활성 프로필에서 cap 초과 변형 제외, cap 없는 모델은 default만.
  const av = input?.effortAvailability;
  const prof = av?.activeProfile !== undefined ? av.profiles?.[av.activeProfile] : undefined;
  const capped: ReviewerCandidate[] = [], cappedOut: ReviewerCandidateExclusion[] = [...gone];
  for (const c of set.candidates) {
    if (!prof) { capped.push(c); continue; }
    const cap = capOfModel(c.baseModelId, av);
    if (cap !== undefined ? effortWithinCap(c.effort, cap) : c.effort === 'default') capped.push(c);
    else cappedOut.push({ modelId: c.modelId, missing: [], reason: cap !== undefined ? 'over-effort-cap' : 'default-only-without-cap' });
  }
  const reviewer = applyReviewerPolicy(capped, { weights });
  // base dedupe: 같은 base는 최고 점수 1개만 남겨 역할 간 공유 가능하게 한다.
  const seen = new Map<string, (typeof reviewer)[number]>();
  for (const r of reviewer) {
    const k = r.baseModelId, prev = seen.get(k);
    if (!prev || (r.score ?? -1) > (prev.score ?? -1)) seen.set(k, r);
  }
  const deduped = [...seen.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return {
    variants,
    candidates: set.candidates,
    reviewer: deduped,
    excluded: [...set.excluded, ...cappedOut],
    ...(set.emptyCause !== undefined && { emptyCause: set.emptyCause }),
    weights,
  };
}
