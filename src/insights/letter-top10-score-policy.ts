import type { OptimalZoneRole } from './letter-top10-worker.js';
import { SCORE_WEIGHTS } from './letter-top10-score-weights.js';

/** p54 승인 C 소스·하한 + p56 오케 가성비(I²/P)·사용량 제거 + p64 오케 가중치 70/0/15/15·상한 폐기·오케 가성비에 Cog 비용 병기. score core와 표시 문구가 같이 읽는다. */
export const SCORE_DIMENSIONS = ['performance', 'usage', 'speed', 'price'] as const;
export type ScoreDimension = typeof SCORE_DIMENSIONS[number];
export type ScoreSource = 'aa' | 'cognition' | 'openrouter' | 'opencode';
export const DIMENSION_LABELS: Readonly<Record<ScoreDimension, string>> = { performance: '성능', usage: '사용량', speed: '속도', price: '가격' };
/** 표시 라벨: 오케의 price 차원은 가성비(I²/P)다. 키는 price로 유지한다. */
export const ROLE_DIMENSION_LABELS: Readonly<Record<OptimalZoneRole, Readonly<Record<ScoreDimension, string>>>> = {
  orchestrator: { ...DIMENSION_LABELS, price: '가성비' }, worker: DIMENSION_LABELS };
/** 오케·리뷰어는 판단 성능 70%에 사용량 5%·속도 10%·가성비 15%를 더해 max가 기본 대표가 되지 않게 한다(p70 확정).
 *  값은 `config/score-weights.json`(p65)에서 읽고, 파일이 없으면 저장소 기본값을 쓴다. 워커·메신저 가중치도 같은 파일에서 온다. */
export const ROLE_DIMENSION_WEIGHTS: Readonly<Record<OptimalZoneRole, Readonly<Record<ScoreDimension, number>>>> = SCORE_WEIGHTS;
/** 차원별 사용 소스. 계열마다 속도·가격 정의가 다르다: 워커는 AA 출력 토큰/s·AA API 혼합 단가만 쓴다(Cognition 시간·비용 불참).
 *  오케 사용량은 p70 확정으로 워커와 같은 OR·OCD 토큰(log10)을 쓰되 가중치만 가볍다(0.05).
 *  오케 price(가성비)는 (a) AA I²/P(USD/1M 혼합단가 기반, 높을수록)와 (b) Cognition USD/task(낮을수록)를 택일하지 않고
 *  소스마다 min-max한 뒤 차원 max로 합친다(p66 확정). 단위가 달라 원값을 더하거나 섞지 않는다. */
export const ROLE_SOURCES: Readonly<Record<OptimalZoneRole, Readonly<Record<ScoreDimension, readonly ScoreSource[]>>>> = {
  orchestrator: { performance: ['aa', 'cognition'], usage: ['openrouter', 'opencode'], speed: ['aa', 'cognition'], price: ['aa', 'cognition'] },
  worker: { performance: ['aa', 'cognition'], usage: ['openrouter', 'opencode'], speed: ['aa'], price: ['aa'] } };
/** 가격 근거가 모두 없을 때의 가격 차원값(최저 관측가 1 다음). 풀 전체에 관측 가격이 없으면 0. 워커에만 적용(오케 가성비 결측은 0). */
export const PRICE_MISSING_VALUE = 0.99;
export const PRICE_MISSING: Readonly<Record<OptimalZoneRole, number | undefined>> = { orchestrator: undefined, worker: PRICE_MISSING_VALUE };
/** 오케 가성비 = I² / (P + 0.01): I=대표 effort AA Intelligence(0~100), P=같은 effort AA 혼합 단가(USD/1M). I·P 결측 또는 I≤0이면 undefined. */
export const valueForMoney = (intelligence?: number, price?: number): number | undefined =>
  intelligence === undefined || price === undefined || !(intelligence > 0) || !(price >= 0) ? undefined : intelligence ** 2 / (price + 0.01);
/** 워커는 전체 후보 풀에서 표준화한 성능이 이 값 미만이면(결측 포함) 후보·보충에서 제외한다. 재정규화하지 않는다. */
export const WORKER_PERFORMANCE_FLOOR = 0.7;
/** p58 오케 effort 변형 순서(동점이면 낮은 쪽). minimal은 AA 등급이라 low 아래에 둔다. default는 순서에 없다(단일일 때만 변형). */
export const ORCHESTRATOR_EFFORT_ORDER = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export const PERFORMANCE_FLOOR: Readonly<Record<OptimalZoneRole, number | undefined>> = { orchestrator: undefined, worker: WORKER_PERFORMANCE_FLOOR };
