import type { RoleCandidate } from './letter-role-selection.js';

export interface ReviewerDimensionWeights {
  readonly performance: number;
  readonly speed: number;
  readonly price: number;
}

/** #195 잠정 가중치: 성능 50% / 속도 20% / 가격 30%.
 *  사용자 승인 전 잠정(provisional)·미확정 기본값이며 오케·워커에는 절대 적용하지 않는다. */
export const PROVISIONAL_REVIEWER_WEIGHTS: ReviewerDimensionWeights = {
  performance: 0.50,
  speed: 0.20,
  price: 0.30,
};

export const REVIEWER_POLICY_STATUS = 'provisional' as const;
export const REVIEWER_POLICY_CONFIRMED = false;

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
  weights: ReviewerDimensionWeights = PROVISIONAL_REVIEWER_WEIGHTS,
  callback?: ReviewerScoreCallback<T>,
): number | undefined {
  if (typeof candidate.score === 'number' && Number.isFinite(candidate.score)) return candidate.score;
  if (callback) return callback(candidate, weights);
  const perf = extractDim(candidate, 'performance');
  const spd = extractDim(candidate, 'speed');
  const prc = extractDim(candidate, 'price');
  if (perf === undefined || spd === undefined || prc === undefined) return undefined;
  return Number((perf * weights.performance + spd * weights.speed + prc * weights.price).toFixed(2));
}

export function applyReviewerPolicy<T extends RoleCandidate = RoleCandidate>(
  candidates: readonly T[],
  config: ReviewerPolicyConfig<T> = {},
): readonly (T & { score?: number })[] {
  const weights: ReviewerDimensionWeights = {
    performance: config.weights?.performance ?? PROVISIONAL_REVIEWER_WEIGHTS.performance,
    speed: config.weights?.speed ?? PROVISIONAL_REVIEWER_WEIGHTS.speed,
    price: config.weights?.price ?? PROVISIONAL_REVIEWER_WEIGHTS.price,
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
