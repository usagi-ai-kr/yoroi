import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRootFrom } from '../config/env-file.js';

/** p65: 역할별 차원 가중치를 `config/score-weights.json`에서 읽는다(계약: docs/insights/score-weights.md).
 *  파일이 없으면 저장소 기본값을 쓴다. 값 오류(모르는 키·누락·숫자 아님·음수·합≠1)는 예외로 멈춘다. */
export const SCORE_WEIGHT_ROLES = ['orchestrator', 'worker'] as const;
export const SCORE_WEIGHT_DIMENSIONS = ['performance', 'usage', 'speed', 'price'] as const;
export type ScoreWeightRole = typeof SCORE_WEIGHT_ROLES[number];
export type ScoreWeightDimension = typeof SCORE_WEIGHT_DIMENSIONS[number];
/** p75: 오케·리뷰어는 가성비(price)를 쓰지 않아 세 차원만 가진다. 워커·메신저는 네 차원이다. */
export const ROLE_WEIGHT_DIMENSIONS: Readonly<Record<ScoreWeightRole, readonly ScoreWeightDimension[]>> = {
  orchestrator: ['performance', 'usage', 'speed'], worker: SCORE_WEIGHT_DIMENSIONS };
export type ScoreWeights = Readonly<Record<ScoreWeightRole, Readonly<Partial<Record<ScoreWeightDimension, number>>>>>;
export const SCORE_WEIGHTS_PATH = resolve(packageRootFrom(import.meta.url), 'config/score-weights.json');
/** 저장소 기본값. 사용자가 파일로 바꾸기 전까지 이 숫자를 코드에서 바꾸지 않는다.
 *  2026-10-15 사용자 확정: 워커 성능/사용량/속도/가격 .30/.20/.10/.40(존 임계 .60, priceMissing .99 유지 —
 *  시뮬레이션 근거 scratch/reports/yoroi-worker-tune-cap2.md·yoroi-worker-tune-final-review.md). */
export const SCORE_WEIGHTS_DEFAULTS: ScoreWeights = {
  orchestrator: { performance: 0.82, usage: 0.06, speed: 0.12 },
  worker: { performance: 0.30, usage: 0.20, speed: 0.10, price: 0.40 } };
/** p85: 워커 가산 상한(점). 기본 점수에 더하는 가산(bonus) 최대값이다. */
export const WORKER_BONUS_CAP_DEFAULT = 5;

const invalid = (detail: string): never => { throw new Error(`Invalid score weights: ${detail}`); };
const includes = (list: readonly string[], value: string): boolean => list.includes(value);

const checkBonusCap = (cap: unknown): number => {
  if (cap === undefined) return WORKER_BONUS_CAP_DEFAULT;
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 0)
    throw new Error('Invalid score weights: workerBonusCap must be a finite number >= 0');
  return cap;
};

/** 잘못된 값은 조용히 무시하지 않고 예외로 멈춘다. 반환값은 역할별 차원(ROLE_WEIGHT_DIMENSIONS)이 모두 있는 표다.
 *  p85: 최상위 `workerBonusCap`(워커 가산 상한, 유한한 0 이상 수)은 차원이 아니라 별도로 검증한다. */
export function validateScoreWeights(raw: unknown): ScoreWeights {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) invalid('root must be an object');
  const source = raw as Record<string, unknown>;
  for (const role of Object.keys(source)) if (role !== 'workerBonusCap' && !includes(SCORE_WEIGHT_ROLES, role)) invalid(`unknown role '${role}'`);
  const result = {} as Record<ScoreWeightRole, Partial<Record<ScoreWeightDimension, number>>>;
  for (const role of SCORE_WEIGHT_ROLES) {
    const weights = source[role];
    if (typeof weights !== 'object' || weights === null || Array.isArray(weights)) invalid(`role '${role}' must be an object`);
    const dimensions = weights as Record<string, unknown>;
    for (const dimension of Object.keys(dimensions)) if (!includes(ROLE_WEIGHT_DIMENSIONS[role], dimension)) invalid(`unknown dimension '${role}.${dimension}'`);
    const values: Partial<Record<ScoreWeightDimension, number>> = {};
    let sum = 0;
    for (const dimension of ROLE_WEIGHT_DIMENSIONS[role]) {
      const value = dimensions[dimension];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
        throw new Error(`Invalid score weights: ${role}.${dimension} must be a finite number >= 0`);
      values[dimension] = value;
      sum += value;
    }
    if (Math.abs(sum - 1) > 1e-9) invalid(`${role} weights must sum to 1 (got ${sum})`);
    result[role] = values;
  }
  checkBonusCap(source['workerBonusCap']);
  return result;
}

/** 파일이 없으면 기본값, 있으면 검증 후 값을 쓴다(검증 실패는 예외). */
export function loadScoreWeights(path: string = SCORE_WEIGHTS_PATH): ScoreWeights {
  if (!existsSync(path)) return SCORE_WEIGHTS_DEFAULTS;
  return validateScoreWeights(JSON.parse(readFileSync(path, 'utf8')) as unknown);
}

/** p85: 워커 가산 상한을 읽는다. 없으면 기본값, 있으면 유한한 0 이상 수여야 한다. */
export function loadWorkerBonusCap(path: string = SCORE_WEIGHTS_PATH): number {
  if (!existsSync(path)) return WORKER_BONUS_CAP_DEFAULT;
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) invalid('root must be an object');
  return checkBonusCap((raw as Record<string, unknown>)['workerBonusCap']);
}

/** 제품이 쓰는 가중치(모듈 로드 시 1회 읽는다). */
export const SCORE_WEIGHTS: ScoreWeights = loadScoreWeights();
/** 제품이 쓰는 워커 가산 상한(모듈 로드 시 1회 읽는다). */
export const WORKER_BONUS_CAP: number = loadWorkerBonusCap();
