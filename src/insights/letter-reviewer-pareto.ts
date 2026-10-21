/** #194 C: 리뷰어 파레토 — 두 축은 "reviewer score 높음" + "실제 비용 낮음"이다.
 *  정규 price 는 역방향(저비용=높은값)이라 비용 비교에 쓰지 않는다. 원시 비용만 쓴다. */
export interface ReviewerParetoInput {
  readonly modelId: string;
  readonly score?: number;
  /** 대표 variant 의 원시 비용(effectiveCost ?? blendedCost). 결측이면 비파레토. */
  readonly cost?: number;
}

const finite = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** 다른 후보가 score>=·cost<= 이고 한쪽이 strict 하면 지배된다. 동점(양쪽 equal)은 비지배. */
export const isParetoDominated = (self: ReviewerParetoInput, others: readonly ReviewerParetoInput[]): boolean => {
  const score = self.score, cost = self.cost;
  if (!finite(score) || !finite(cost)) return true;
  return others.some(other => {
    if (other === self) return false;
    const otherScore = other.score, otherCost = other.cost;
    if (!finite(otherScore) || !finite(otherCost)) return false;
    const scoreGe = otherScore >= score, costLe = otherCost <= cost;
    return scoreGe && costLe && (otherScore > score || otherCost < cost);
  });
};

/** 전체 적격 후보(컷 전)에서 비지배 후보에 isPareto 를 붙인다. 입력 순서는 결과에 영향이 없다. */
export const markReviewerPareto = <T extends ReviewerParetoInput>(
  candidates: readonly T[],
): readonly (T & { readonly isPareto: boolean })[] =>
  candidates.map(candidate => ({ ...candidate, isPareto: !isParetoDominated(candidate, candidates) }));
