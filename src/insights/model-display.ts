/** #260: 표시 전용 모델 id 정규화 — 규칙 파일(위→아래)을 순서대로 적용한다.
 *  **표시 전용**: 내부 id·점수·순위·후보·Free 값에는 영향이 없다.
 *  규칙 파일이 없거나 형식이 잘못됐거나 정규식이 잘못되면 예외 없이 raw id로 폴백한다. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRootFrom } from '../config/env-file.js';

export interface ModelDisplayRule {
  readonly match?: string;
  readonly replace?: string;
  readonly flags?: string;
}
export const MODEL_DISPLAY_RULES_PATH = resolve(packageRootFrom(import.meta.url), 'config/model-display-rules.json');

/** 규칙 파일을 읽는다. 없거나 비배열·파싱 실패면 규칙 0개(= raw id 표시) — 예외 없음. */
export const loadModelDisplayRules = (path: string = MODEL_DISPLAY_RULES_PATH): readonly ModelDisplayRule[] => {
  if (!existsSync(path)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const rules = (parsed as { rules?: unknown } | null)?.rules;
    if (!Array.isArray(rules)) return [];
    return rules.filter((rule): rule is ModelDisplayRule => typeof rule === 'object' && rule !== null);
  } catch { return []; }
};

/** 규칙을 위→아래 순서로 적용한다. 잘못된 정규식 규칙은 건너뛰고 원본을 유지한다.
 *  접미가 겹친 경우(-free-high 등)도 정규화되도록 더 이상 변하지 않을 때까지 반복한다(최대 4회). */
export const applyModelDisplayRules = (modelId: string, rules: readonly ModelDisplayRule[] = loadModelDisplayRules()): string => {
  let out = modelId;
  for (let pass = 0; pass < 4; pass += 1) {
    let next = out;
    for (const rule of rules) {
      if (typeof rule.match !== 'string' || rule.match.length === 0) continue;
      try { next = next.replace(new RegExp(rule.match, rule.flags), rule.replace ?? ''); }
      catch { /* 잘못된 정규식은 건너뛰고 raw 유지 */ }
    }
    if (next === out) break;
    out = next;
  }
  return out;
};

/** 표시용 모델 이름(공통 helper). 빈 값은 빈 문자열. */
export const displayModelId = (modelId: string): string =>
  typeof modelId === 'string' ? applyModelDisplayRules(modelId) : '';

/** #261: canonical id — 표시와 Free/open 자격 판정이 같은 규칙을 쓴다(-free·effort 접미 제거). */
export const canonicalModelId = (modelId: string): string => displayModelId(modelId);
