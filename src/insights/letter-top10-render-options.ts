import { toRankedRecords, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
import type { EffortAvailability } from './letter-effort-availability.js';

/** 레터 렌더 입력 중 순위 산출에 쓰는 보조 근거 레코드(compact·markdown 공통). */
export interface Top10EvidenceInput {
  readonly openrouterRecords?: readonly Top10RecordInput[]; readonly opencodeDataRecords?: readonly Top10RecordInput[];
  readonly previousRanks?: readonly Top10RecordInput[];
  /** Cognition main 근거(cognition_correct·cognition_cost·cognition_duration_min). */
  readonly cognitionRecords?: readonly Top10RecordInput[];
  /** 주입 카탈로그(테스트·대체 요금제). 없으면 PLAN_CATALOG. */
  readonly catalog?: Top10Options['catalog'];
  /** p51: 런타임 검증 free 카탈로그. 전체 Top10 후보에도 합친다. */
  readonly freeCatalog?: Top10Options['freeCatalog'];
  /** #188: 환경별 effort 가용성 주입. 없으면 computeRoleTop10이 env 게이트(YOROI_EFFORT_PROFILE)로 기본 해석한다. */
  readonly effortAvailability?: EffortAvailability;
}
/** compact·markdown·Free 경로가 같은 옵션을 쓰도록 한 곳에서 만든다(cognitionRecords 전파 누락 방지). */
export const top10OptionsFrom = (input: Top10EvidenceInput): Top10Options => ({
  ...(input.openrouterRecords && { openrouterRecords: toRankedRecords(input.openrouterRecords) }),
  ...(input.opencodeDataRecords && { opencodeDataRecords: input.opencodeDataRecords }),
  ...(input.cognitionRecords && { cognitionRecords: input.cognitionRecords }),
  ...(input.catalog && { catalog: input.catalog }),
  ...(input.freeCatalog?.length && { freeCatalog: input.freeCatalog }),
  ...(input.previousRanks && { previousCohort: input.previousRanks }),
  ...(input.effortAvailability && { effortAvailability: input.effortAvailability }),
  // p51: Free 전용 모델의 전역 제외(freeOnlyModelIds)는 폐기했다. Free 모델도 전체 Top10 후보다.
});
