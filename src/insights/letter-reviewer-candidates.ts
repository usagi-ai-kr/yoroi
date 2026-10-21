import type { ModelVariant } from './letter-top10-group.js';
import { normalizeModelName } from './model-id.js';
import { invertDim, normalizeDim } from './letter-reviewer-candidate-normalize.js';

/** reviewer blend용 정규 후보. score 없음 (구·신 computeReviewerScore 모두 blend 강제).
 *  value는 원시 추적용. effort·modelId 식별 보존. */
export interface ReviewerCandidate {
  readonly modelId: string;
  readonly baseModelId: string;
  readonly effort: string;
  readonly value: number;
  readonly performance: number;
  readonly speed: number;
  readonly price: number;
  /** 대표 variant 의 원시 비용(effectiveCost ?? blendedCost). 파레토 비교는 이 값만 쓴다(정규 price 는 역방향). */
  readonly cost: number;
  readonly [key: string]: unknown;
}

export type ReviewerDimKey = 'performance' | 'speed' | 'price';

export interface ReviewerCandidateExclusion {
  readonly modelId: string;
  readonly missing: readonly ReviewerDimKey[];
  readonly reason: string;
}

export interface ReviewerCandidateSet {
  readonly candidates: readonly ReviewerCandidate[];
  readonly excluded: readonly ReviewerCandidateExclusion[];
  readonly emptyCause?: string;
}

const rawOf = (v: ModelVariant): { performance?: number; speed?: number; price?: number } => ({
  ...(Number.isFinite(v.value) && { performance: v.value }),
  ...(v.outputTokensPerSecond !== undefined && Number.isFinite(v.outputTokensPerSecond) && { speed: v.outputTokensPerSecond }),
  ...((v.effectiveCost ?? v.blendedCost) !== undefined && Number.isFinite((v.effectiveCost ?? v.blendedCost)!) && { price: (v.effectiveCost ?? v.blendedCost)! }),
});

/** ModelVariant 전체 풀 → reviewer blend용 정규 후보. 가중치는 다루지 않는다
 *  (w3 주입점에서 applyReviewerPolicy가 w2 config 원본으로 수행. adapter에 숫자 없음).
 *  3차원 완비만 통과, 결측은 excluded에 이유와 함께. 입력 배열 변경 없음. */
export function toReviewerCandidates(variants: readonly ModelVariant[]): ReviewerCandidateSet {
  const raws = variants.map(rawOf);
  const idx = raws.map((r, i) => ({ r, i })).filter(({ r }) =>
    r.performance !== undefined && r.speed !== undefined && r.price !== undefined);
  const excluded: ReviewerCandidateExclusion[] = raws.map((r, i) => ({ r, i }))
    .filter(({ r }) => r.performance === undefined || r.speed === undefined || r.price === undefined)
    .map(({ r, i }) => {
      const missing = (['performance', 'speed', 'price'] as const).filter(k => r[k] === undefined);
      return { modelId: variants[i]!.modelId, missing, reason: `missing reviewer evidence: ${missing.join(',')}` };
    });
  if (idx.length === 0) {
    return { candidates: [], excluded, emptyCause: `no reviewer-blendable candidates (${variants.length} variants, all missing evidence)` };
  }
  const perf = normalizeDim(idx.map(({ r }) => r.performance!));
  const spd = normalizeDim(idx.map(({ r }) => r.speed!));
  const prc = invertDim(idx.map(({ r }) => r.price!));
  const candidates = idx.map(({ r, i }, k) => {
    const v = variants[i]!;
    // 날짜 snapshot suffix(-1017 등)를 포함한 AA id를 base canonical로 정규화해
    // 같은 모델의 dated variant가 별도 행으로 갈라지지 않게 한다.
    return { modelId: normalizeModelName(v.modelId), baseModelId: normalizeModelName(v.baseModelId),
      effort: v.effort, value: r.performance!, performance: perf[k]!, speed: spd[k]!, price: prc[k]!, cost: r.price! };
  });
  return candidates.length === 0 ? { candidates, excluded, emptyCause: 'unreachable' } : { candidates, excluded };
}
