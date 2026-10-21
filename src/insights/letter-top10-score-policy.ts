import type { OptimalZoneRole } from './letter-top10-worker.js';
import { ROLE_WEIGHT_DIMENSIONS, SCORE_WEIGHTS } from './letter-top10-score-weights.js';

/** p54 승인 C 소스·하한 + R(1.2.1) 오케 성능 0.75·사용량 0·속도 0.10·가성비 0.15. */
export const SCORE_DIMENSIONS = ['performance', 'usage', 'speed', 'price'] as const;
export type ScoreDimension = typeof SCORE_DIMENSIONS[number];
export type ScoreSource = 'aa' | 'cognition' | 'openrouter' | 'opencode';
export const DIMENSION_LABELS: Readonly<Record<ScoreDimension, string>> = { performance: '성능', usage: '사용량', speed: '속도', price: '가격' };
/** 양수 가중치 차원만 표시한다: 오케 성능/속도/가성비, 워커 네 차원. */
export const ROLE_DIMENSIONS: Readonly<Record<OptimalZoneRole, readonly ScoreDimension[]>> = ROLE_WEIGHT_DIMENSIONS;
/** 오케·리뷰어는 성능 75%·속도 10%·가성비 15%를 쓴다(사용량 가중치 0; I/(P+.01)).
 *  워커·메신저는 p85 확정 산식: 기본 100×(0.375·성능 + 0.125·속도 + 0.5·가격)에 가산(최대 WORKER_BONUS_CAP점).
 *  값은 `config/score-weights.json`(p65)에서 읽고, 파일이 없으면 저장소 기본값을 쓴다. */
export const ROLE_DIMENSION_WEIGHTS: Readonly<Record<OptimalZoneRole, Readonly<Partial<Record<ScoreDimension, number>>>>> = SCORE_WEIGHTS;
/** 차원별 사용 소스. 계열마다 속도·가격 정의가 다르다: 워커는 AA 출력 토큰/s·AA API 혼합 단가만 쓴다(Cognition 시간·비용 불참).
 *  사용량은 점수 차원에서 제외한다. 오케 price(가성비)는 (a) AA I/(P+0.01)(USD/1M 혼합단가 기반, 높을수록) · (b) Cognition USD/task(낮을수록)를 택일하지 않고
 *  소스마다 min-max한 뒤 차원 max로 합친다. 단위가 달라 원값을 더하거나 섞지 않는다. */
export const ROLE_SOURCES: Readonly<Record<OptimalZoneRole, Readonly<Record<ScoreDimension, readonly ScoreSource[]>>>> = {
  orchestrator: { performance: ['aa', 'cognition'], usage: ['openrouter', 'opencode'], speed: ['aa', 'cognition'], price: ['aa', 'cognition'] },
  worker: { performance: ['aa', 'cognition'], usage: ['openrouter', 'opencode'], speed: ['aa'], price: ['aa'] } };
/** 가격 근거가 모두 없을 때의 가격 차원값(최저 관측가 1 다음). 풀 전체에 관측 가격이 없으면 0. 워커에만 적용. */
export const PRICE_MISSING_VALUE = 0.99;
export const PRICE_MISSING: Readonly<Record<OptimalZoneRole, number | undefined>> = { orchestrator: undefined, worker: PRICE_MISSING_VALUE };
/** U1: 메신저는 워커와 같은 데이터 배관(cap·대표 effort·속도·가격·가산·intel 하한)을 쓴다.
 *  `role === 'worker'` 분기를 묶는 공용 helper. 가중치·임계만 메신저 값을 쓴다.
 *  U2: 전역 OptimalZoneRole 확장은 렌더러·언소유 타입 파급으로 보류한다.
 *  소유 모듈은 RoleWithMessenger(orch|worker|messenger)로 메신저 경로를 처리하고,
 *  언소유 호출에는 worker 매핑(srcRole)으로 전달해 기존 출력을 바이트 동일하게 보존한다. */
export const isWorkerLike = (role: string): role is 'worker' | 'messenger' =>
  role === 'worker' || role === 'messenger';
/** U2: 소유 모듈 전용 메신저 포함 역할. 전역 OptimalZoneRole은 orch|worker로 둔다. */
export type WorkerLikeRole = 'worker' | 'messenger';
export type RoleWithMessenger = OptimalZoneRole | 'messenger';
/** U1: 메신저 존 임계 0.60(워커와 동일). 가격 결측 0.99·intel 하한 33도 공유한다. */
export const MESSENGER_THRESHOLD = 0.60;
/** User-confirmed worker price rules: score-only held-plan uplift at p75, AA mixed USD/M cap. */
export const WORKER_HELD_PRICE_QUANTILE = 0.75;
export const WORKER_MIXED_PRICE_CAP_USD_PER_M = 5;
/** 패키지 설치본에서 config/held-plans.json이 빠질 때 쓸 사용자 확정 보유 플랜 ID. */
export const WORKER_HELD_PLAN_IDS_DEFAULT = [
  'chatgpt-plus', 'claude-pro', 'google-ai-pro', 'ollama-cloud-pro',
  'opencode-go-plus', 'zen-free', 'antigravity', 'cursor'
] as const;
/** 오케 가성비 = I / (P + 0.01): I=대표 effort AA Intelligence(0~100), P=같은 effort AA 혼합 단가(USD/1M). I·P 결측 또는 I≤0이면 undefined. p70 원안은 I²이었으나 1.0.2에서 선형으로 확정(제곱 없음). */
export const valueForMoney = (intelligence?: number, price?: number): number | undefined =>
  intelligence === undefined || price === undefined || !(intelligence > 0) || !(price >= 0) ? undefined : intelligence / (price + 0.01);
/** 워커는 전체 후보 풀에서 표준화한 성능이 이 값 미만이면(결측 포함) 후보·보충에서 제외한다. 재정규화하지 않는다.
 *  p85: 표준화 하한은 폐지하고 원값 하한(WORKER_INTEL_FLOOR)을 쓴다. 상수는 이전 규칙 기록으로 둔다. */
export const WORKER_PERFORMANCE_FLOOR = 0.7;
/** p85: 워커 성능 하한은 AA intelligence_index 원값 33이다. 후보·▽ 보충 자격 모두에 적용한다. intel이 없으면 후보에서 제외한다. */
export const WORKER_INTEL_FLOOR = 33;
/** p58 오케 effort 변형 순서(동점이면 낮은 쪽). minimal은 AA 등급이라 low 아래에 둔다. default는 순서에 없다(단일일 때만 변형). */
export const ORCHESTRATOR_EFFORT_ORDER = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export const PERFORMANCE_FLOOR: Readonly<Record<OptimalZoneRole, number | undefined>> = { orchestrator: undefined, worker: WORKER_PERFORMANCE_FLOOR };
