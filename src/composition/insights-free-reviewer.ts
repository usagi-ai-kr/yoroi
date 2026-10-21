/** #194 D: Free 표 3역할 리뷰어 칸 배선.
 *  verified 공식 Free 카탈로그에 있는 모델만, 별칭 해석 후 exact id 로 매칭해 FreeReviewerEntry 로 만든다.
 *  점수·파레토는 전달값 그대로(생성·추정 없음). */
import type { FreeReviewerEntry } from '../insights/letter-markdown-free-sort.js';
import type { ThreeRolePipelineOutput } from '../insights/letter-three-role-pipeline.js';
import type { PlanCatalogEntry } from '../insights/plan-catalog.js';
import { resolveModelId } from '../insights/model-aliases.js';
import { normalizeModelName } from '../insights/model-id.js';

export interface ReviewerCandidateLike {
  readonly modelId: string;
  readonly score?: number;
  readonly isPareto?: boolean;
}

/** Free id(-free 접미) → AA base id. 검증된 명시 별칭 규칙만 쓴다. */
const resolveFreeId = (modelId: string): string =>
  resolveModelId(normalizeModelName(modelId), new Map(), new Set());
/** 공개: 카탈로그 id(Free '-free' 형태 가능) → AA base id. */
export const resolveFreeModelId = resolveFreeId;

/** verified 공식 Free 카탈로그의 base id 집합(티어 free + verified 모델만). 빈/미지 입력은 빈 집합. */
export const freeBaseIds = (freeCatalog: readonly PlanCatalogEntry[] | undefined): ReadonlySet<string> =>
  new Set((freeCatalog ?? []).filter(plan => plan.tier === 'free')
    .flatMap(plan => plan.models.filter(model => model.verified).map(model => resolveFreeId(model.modelId))));

/** AA base id → 공식 Free ID(-free 포함) 매핑. Free 행 id 와 정확히 같은 키로 합친다. */
export const freeIdByBase = (freeCatalog: readonly PlanCatalogEntry[] | undefined): ReadonlyMap<string, string> => {
  const map = new Map<string, string>();
  for (const plan of (freeCatalog ?? []).filter(p => p.tier === 'free'))
    for (const model of plan.models.filter(m => m.verified)) map.set(resolveFreeId(model.modelId), model.modelId);
  return map;
};

/** reviewer 후보 → FreeReviewerEntry. 점수가 없는 후보는 넣지 않는다(근거 없는 점수 금지). */
export const freeReviewerEntries = (
  reviewer: readonly ReviewerCandidateLike[],
  freeCatalog: readonly PlanCatalogEntry[] | undefined,
): readonly FreeReviewerEntry[] => {
  if (!freeCatalog?.length) return [];
  const byBase = freeIdByBase(freeCatalog);
  return reviewer
    .filter(candidate => byBase.has(normalizeModelName(candidate.modelId))
      && typeof candidate.score === 'number' && Number.isFinite(candidate.score))
    .map(candidate => ({ modelId: byBase.get(normalizeModelName(candidate.modelId))!, score: candidate.score!.toFixed(2),
      passed: true, isPareto: candidate.isPareto === true }));
};

/** 3역할 활성일 때만 Free 표용 리뷰어 근거를 만든다(비활성이면 undefined → 기존 2역할 출력 유지). */
export const freeReviewerFor = (threeRole: (ThreeRolePipelineOutput & { readonly reviewerPool?: readonly ReviewerCandidateLike[] }) | undefined,
  top10: { readonly freeCatalog?: readonly PlanCatalogEntry[] } | undefined): readonly FreeReviewerEntry[] | undefined => {
  // #194 D: selection/top15 이 아니라 **producer 의 전체 eligible reviewer** 를 그대로 소비한다.
  if (!threeRole?.reviewerPool?.length) return undefined;
  return freeReviewerEntries(threeRole.reviewerPool, top10?.freeCatalog);
};

/** U3a-ii: Free 표 메신저 칸 배선. reviewer와 같은 원칙(verified·exact id·점수 전달·미지 제외). */
export const freeMessengerEntries = (
  messenger: readonly ReviewerCandidateLike[],
  freeCatalog: readonly PlanCatalogEntry[] | undefined,
): readonly FreeReviewerEntry[] => {
  if (!freeCatalog?.length) return [];
  const byBase = freeIdByBase(freeCatalog);
  // messenger 후보 id는 카탈로그형(-free 접미 가능)이라 base로 해석 후 매칭한다.
  return messenger
    .filter(candidate => byBase.has(resolveFreeId(candidate.modelId))
      && typeof candidate.score === 'number' && Number.isFinite(candidate.score))
    .map(candidate => ({ modelId: byBase.get(resolveFreeId(candidate.modelId))!, score: candidate.score!.toFixed(2),
      passed: true, isPareto: candidate.isPareto === true }));
};

/** 3역할 활성 + messengerPool이 있을 때만 Free 표용 메신저 근거를 만든다(없으면 undefined → 기존 표 유지). */
export const freeMessengerFor = (threeRole: (ThreeRolePipelineOutput & { readonly messengerPool?: readonly ReviewerCandidateLike[] }) | undefined,
  top10: { readonly freeCatalog?: readonly PlanCatalogEntry[] } | undefined): readonly FreeReviewerEntry[] | undefined => {
  // selection 컷이 아니라 **producer 의 전체 eligible messenger**(messengerPool)를 그대로 소비한다.
  if (!threeRole?.messengerPool?.length) return undefined;
  return freeMessengerEntries(threeRole.messengerPool, top10?.freeCatalog);
};
