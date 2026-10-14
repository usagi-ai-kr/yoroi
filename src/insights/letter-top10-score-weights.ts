import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRootFrom } from '../config/env-file.js';

/** p65: 역할별 차원 가중치를 `config/score-weights.json`에서 읽는다(계약: docs/insights/score-weights.md).
 *  파일이 없으면 저장소 기본값을 쓴다. 값 오류(모르는 키·누락·숫자 아님·음수·합≠1)는 예외로 멈춘다. */
export const SCORE_WEIGHT_ROLES = ['orchestrator', 'worker'] as const;
export const SCORE_WEIGHT_DIMENSIONS = ['performance', 'usage', 'speed', 'price'] as const;
export type ScoreWeightRole = typeof SCORE_WEIGHT_ROLES[number];
export type ScoreWeightDimension = typeof SCORE_WEIGHT_DIMENSIONS[number];
export type ScoreWeights = Readonly<Record<ScoreWeightRole, Readonly<Record<ScoreWeightDimension, number>>>>;
export const SCORE_WEIGHTS_PATH = resolve(packageRootFrom(import.meta.url), 'config/score-weights.json');
/** 저장소 기본값. 사용자가 파일로 바꾸기 전까지 이 숫자를 코드에서 바꾸지 않는다. */
export const SCORE_WEIGHTS_DEFAULTS: ScoreWeights = {
  orchestrator: { performance: 0.7, usage: 0.05, speed: 0.1, price: 0.15 },
  worker: { performance: 0.3, usage: 0.2, speed: 0.1, price: 0.4 } };

const invalid = (detail: string): never => { throw new Error(`Invalid score weights: ${detail}`); };
const includes = (list: readonly string[], value: string): boolean => list.includes(value);

/** 잘못된 값은 조용히 무시하지 않고 예외로 멈춘다. 반환값은 두 역할×네 차원이 모두 있는 표다. */
export function validateScoreWeights(raw: unknown): ScoreWeights {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) invalid('root must be an object');
  const source = raw as Record<string, unknown>;
  for (const role of Object.keys(source)) if (!includes(SCORE_WEIGHT_ROLES, role)) invalid(`unknown role '${role}'`);
  const result = {} as Record<ScoreWeightRole, Record<ScoreWeightDimension, number>>;
  for (const role of SCORE_WEIGHT_ROLES) {
    const weights = source[role];
    if (typeof weights !== 'object' || weights === null || Array.isArray(weights)) invalid(`role '${role}' must be an object`);
    const dimensions = weights as Record<string, unknown>;
    for (const dimension of Object.keys(dimensions)) if (!includes(SCORE_WEIGHT_DIMENSIONS, dimension)) invalid(`unknown dimension '${role}.${dimension}'`);
    const values = {} as Record<ScoreWeightDimension, number>;
    let sum = 0;
    for (const dimension of SCORE_WEIGHT_DIMENSIONS) {
      const value = dimensions[dimension];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
        throw new Error(`Invalid score weights: ${role}.${dimension} must be a finite number >= 0`);
      values[dimension] = value;
      sum += value;
    }
    if (Math.abs(sum - 1) > 1e-9) invalid(`${role} weights must sum to 1 (got ${sum})`);
    result[role] = values;
  }
  return result;
}

/** 파일이 없으면 기본값, 있으면 검증 후 값을 쓴다(검증 실패는 예외). */
export function loadScoreWeights(path: string = SCORE_WEIGHTS_PATH): ScoreWeights {
  if (!existsSync(path)) return SCORE_WEIGHTS_DEFAULTS;
  return validateScoreWeights(JSON.parse(readFileSync(path, 'utf8')) as unknown);
}

/** 제품이 쓰는 가중치(모듈 로드 시 1회 읽는다). */
export const SCORE_WEIGHTS: ScoreWeights = loadScoreWeights();
