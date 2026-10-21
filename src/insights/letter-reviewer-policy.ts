import type { RoleCandidate } from './letter-role-selection.js';
import {
  REVIEWER_WEIGHTS,
  type ReviewerDimensionWeights,
} from '../config/reviewer-policy.js';

export type { ReviewerDimensionWeights };

/** #195 사용자 확정 가중치: config/reviewer-policy.json 원본 (성능 50% / 속도 20% / 가격 30%).
 *  하드코드 금지 — 운영자 JSON 설정에 따라 즉시 반영된다. 오케·워커에는 절대 적용하지 않는다. */
export const CONFIRMED_REVIEWER_WEIGHTS: ReviewerDimensionWeights = REVIEWER_WEIGHTS;
export const PROVISIONAL_REVIEWER_WEIGHTS: ReviewerDimensionWeights = REVIEWER_WEIGHTS;
export const REVIEWER_POLICY_STATUS = 'confirmed' as const;
export const REVIEWER_POLICY_CONFIRMED = true;

export interface ReviewerCandidateEvidence {
  readonly performance?: number;
  readonly speed?: number;
  readonly price?: number;
  readonly [key: string]: unknown;
}

export type ReviewerScoreCallback<T extends RoleCandidate = RoleCandidate> =
  (candidate: T, weights: ReviewerDimensionWeights) => number | undefined;

export interface ReviewerPolicyConfig<T extends RoleCandidate = RoleCandidate> {
  readonly weights?: Partial<ReviewerDimensionWeights>;
  readonly scoreCallback?: ReviewerScoreCallback<T>;
  readonly sortByScore?: boolean;
}

const extractDim = (candidate: RoleCandidate, key: keyof ReviewerDimensionWeights): number | undefined => {
  const direct = candidate[key];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  const ev = (candidate as { evidence?: Record<string, unknown> }).evidence;
  if (ev && typeof ev[key] === 'number' && Number.isFinite(ev[key])) return ev[key] as number;
  return undefined;
};

export function computeReviewerScore<T extends RoleCandidate = RoleCandidate>(
  candidate: T,
  weights: ReviewerDimensionWeights = REVIEWER_WEIGHTS,
  callback?: ReviewerScoreCallback<T>,
): number | undefined {
  if (callback) return callback(candidate, weights);
  const perf = extractDim(candidate, 'performance');
  const spd = extractDim(candidate, 'speed');
  const prc = extractDim(candidate, 'price');
  if (perf !== undefined && spd !== undefined && prc !== undefined) {
    // #233: 0~1 정규 근거 → 0~100(소수 1자리)로 통일한다. 가중치·정렬·파레토 기준 불변.
    return Number(((perf * weights.performance + spd * weights.speed + prc * weights.price) * 100).toFixed(1));
  }
  if (typeof candidate.score === 'number' && Number.isFinite(candidate.score)) return candidate.score;
  return undefined;
}

export function applyReviewerPolicy<T extends RoleCandidate = RoleCandidate>(
  candidates: readonly T[],
  config: ReviewerPolicyConfig<T> = {},
): readonly (T & { score?: number })[] {
  const weights: ReviewerDimensionWeights = {
    performance: config.weights?.performance ?? REVIEWER_WEIGHTS.performance,
    speed: config.weights?.speed ?? REVIEWER_WEIGHTS.speed,
    price: config.weights?.price ?? REVIEWER_WEIGHTS.price,
  };
  const scored = candidates.map(c => {
    const score = computeReviewerScore(c, weights, config.scoreCallback);
    return score !== undefined ? { ...c, score } : c;
  });
  if (config.sortByScore === false) return scored;
  return [...scored].sort((a, b) => {
    const aHas = typeof a.score === 'number' && Number.isFinite(a.score);
    const bHas = typeof b.score === 'number' && Number.isFinite(b.score);
    if (aHas && bHas) return (b.score as number) - (a.score as number);
    if (aHas) return -1;
    if (bHas) return 1;
    return 0;
  });
}
