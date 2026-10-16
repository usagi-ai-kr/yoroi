import type { OptimalZoneRole } from './letter-top10-worker.js';
import { ROLE_WEIGHT_DIMENSIONS, SCORE_WEIGHTS } from './letter-top10-score-weights.js';

/** p54 승인 C 소스·하한 + R(1.0.2) 오케 가성비 복구(오케 성능 0.70·사용량 0.05·속도 0.10·가성비 0.15). score core와 표시 문구가 같이 읽는다. */
export const SCORE_DIMENSIONS = ['performance', 'usage', 'speed', 'price'] as const;
export type ScoreDimension = typeof SCORE_DIMENSIONS[number];
export type ScoreSource = 'aa' | 'cognition' | 'openrouter' | 'opencode';
export const DIMENSION_LABELS: Readonly<Record<ScoreDimension, string>> = { performance: '성능', usage: '사용량', speed: '속도', price: '가격' };
/** 역할별 표시·가중 차원. 오케·리뷰어는 성능/사용량/속도/가성비 네 칸, 워커·메신저도 네 칸(가격 포함). */
export const ROLE_DIMENSIONS: Readonly<Record<OptimalZoneRole, readonly ScoreDimension[]>> = ROLE_WEIGHT_DIMENSIONS;
/** 오케·리뷰어는 판단 성능 70%에 사용량 5%·속도 10%·가성비 15%를 더한다(R 1.0.2: 70/5/10/15, 가성비 복구 — I/(P+.01)).
 *  워커·메신저는 p85 확정 산식: 기본 100×(0.375·성능 + 0.125·속도 + 0.5·가격)에 가산(최대 WORKER_BONUS_CAP점).
 *  값은 `config/score-weights.json`(p65)에서 읽고, 파일이 없으면 저장소 기본값을 쓴다. */
export const ROLE_DIMENSION_WEIGHTS: Readonly<Record<OptimalZoneRole, Readonly<Partial<Record<ScoreDimension, number>>>>> = SCORE_WEIGHTS;
/** 차원별 사용 소스. 계열마다 속도·가격 정의가 다르다: 워커는 AA 출력 토큰/s·AA API 혼합 단가만 쓴다(Cognition 시간·비용 불참).
 *  오케 사용량은 워커와 같은 OR·OCD 토큰(log10)을 쓰되 가중치만 가볍다(0.05). 오케 price(가성비)는 (a) AA I/(P+0.01)(USD/1M 혼합단가 기반, 높을수록, 제곱 없음 — 1.0.2 결정) · (b) Cognition USD/task(낮을수록)를 택일하지 않고
 *  소스마다 min-max한 뒤 차원 max로 합친다. 단위가 달라 원값을 더하거나 섞지 않는다. */
export const ROLE_SOURCES: Readonly<Record<OptimalZoneRole, Readonly<Record<ScoreDimension, readonly ScoreSource[]>>>> = {
  orchestrator: { performance: ['aa', 'cognition'], usage: ['openrouter', 'opencode'], speed: ['aa', 'cognition'], price: ['aa', 'cognition'] },
  worker: { performance: ['aa', 'cognition'], usage: ['openrouter', 'opencode'], speed: ['aa'], price: ['aa'] } };
/** 가격 근거가 모두 없을 때의 가격 차원값(최저 관측가 1 다음). 풀 전체에 관측 가격이 없으면 0. 워커에만 적용. */
export const PRICE_MISSING_VALUE = 0.99;
export const PRICE_MISSING: Readonly<Record<OptimalZoneRole, number | undefined>> = { orchestrator: undefined, worker: PRICE_MISSING_VALUE };
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
