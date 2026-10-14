import { calcBlendedCost, calcCostEfficiency, type ModelVariant } from './letter-top10-group.js';
import { normalizeModelName } from './model-id.js';
import { findOffPeakRate, isOffPeakHour, OFF_PEAK_RATES, type OffPeakRate } from './model-price-overrides.js';

/** 사용자 규칙 제외 계열(소문자 부분 일치): Fable·Astra. */
export const EXCLUDED_PATTERNS = ['fable', 'astra'] as const;

export function isExcludedModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return EXCLUDED_PATTERNS.some(pattern => id.includes(pattern));
}

/** 연속된 숫자 토큰(중간 포함)을 버전으로 파싱한다(예 claude-opus-5-5 → claude-opus [5,5],
 * gpt-6-1-sol → gpt-sol [6,1], gemini-3-8-flash → gemini-flash [3,8]).
 * 숫자 토큰이 없거나 family가 비면 null → 제외하지 않는다(오판 방지). */
export function parseFamilyVersion(baseModelId: string): { family: string; version: readonly number[] } | null {
  const tokens = baseModelId.trim().toLowerCase().split('-');
  const start = tokens.findIndex(token => /^\d+$/.test(token));
  if (start < 0) return null;
  let end = start;
  while (end + 1 < tokens.length && /^\d+$/.test(tokens[end + 1]!)) end++;
  const family = tokens.filter((_, i) => i < start || i > end).join('-');
  if (!family) return null;
  return { family, version: tokens.slice(start, end + 1).map(Number) };
}

export function compareVersions(a: readonly number[], b: readonly number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** GPT의 같은 세대 하위 등급 토큰. */
export const GRADE_TOKENS = ['luna', 'terra', 'sol'] as const;

/** parseFamilyVersion의 기본 family별로 확인된 후속 등급만 등록한다. */
const BASE_MODEL_GRADES: Readonly<Record<string, readonly string[]>> = { 'mimo-v2': ['flash', 'pro'], 'kimi-k2': ['code'] };

/** GPT family 꼬리 등급만 합친다. 다른 벤더의 같은 토큰은 별도 family로 둔다. */
export function vendorLine(family: string): string {
  const parts = family.split('-'), grade = parts.at(-1)!;
  return parts[0] === 'gpt' && (GRADE_TOKENS as readonly string[]).includes(grade) ? parts.slice(0, -1).join('-') : family;
}

const modelKey = (id: string): string => normalizeModelName(id);
/** 사용량 초과 시 별도로 선택하는 두 Sol 모델은 버전 교체 대상으로 보지 않는다(2026-10-14 사용자 결정). */
export const separateGptSolModels = (a: string, b: string): boolean =>
  new Set([normalizeModelName(a), normalizeModelName(b)]).size === 2 &&
  ['gpt-6-sol', 'gpt-6-1-sol'].every(id => id === normalizeModelName(a) || id === normalizeModelName(b));
const isGptGrade = (family: string): boolean => {
  const parts = family.split('-');
  return parts[0] === 'gpt' && (GRADE_TOKENS as readonly string[]).includes(parts.at(-1)!);
};
/** 같은 family는 전체 버전, GPT 등급끼리는 메이저, 등록된 기본형→등급은 전체 버전을 비교한다. */
function supersedes(newer: NonNullable<ReturnType<typeof parseFamilyVersion>>,
  older: NonNullable<ReturnType<typeof parseFamilyVersion>>): boolean {
  if (newer.family === older.family) {
    if (newer.family === 'gpt-sol' && separateGptSolModels(
      `gpt-${newer.version.join('-')}-sol`, `gpt-${older.version.join('-')}-sol`)) return false;
    return compareVersions(newer.version, older.version) > 0;
  }
  if (isGptGrade(newer.family) && isGptGrade(older.family) && vendorLine(newer.family) === vendorLine(older.family) &&
    (newer.version[0] ?? 0) > (older.version[0] ?? 0)) return true;
  if (isGptGrade(older.family)) return false;
  const grades = BASE_MODEL_GRADES[older.family];
  const parts = newer.family.split('-');
  return grades?.includes(parts.at(-1)!) === true &&
    parts.slice(0, -1).join('-') === older.family && compareVersions(newer.version, older.version) > 0;
}
/** 전체 접근 가능 AA 모델 집합에서 같은 등급은 전체 버전, GPT 교차 등급은 메이저 세대를 비교한다. */
export function olderGenerationModelIds(modelIds: readonly string[]): ReadonlySet<string> {
  const parsed = modelIds.map(id => ({ id: modelKey(id), pv: parseFamilyVersion(modelKey(id)) }));
  return new Set(parsed.filter(x => { const pv = x.pv;
    return pv !== null && parsed.some(y => y.pv !== null && supersedes(y.pv, pv)); }).map(x => x.id));
}

/** 같은 family의 낮은 버전 및 더 낮은 GPT 메이저를 제외한다. 파싱 불가·동일 세대는 유지한다. */
export function dropOlderVersions(variants: readonly ModelVariant[]): ModelVariant[] {
  const older = olderGenerationModelIds(variants.map(v => v.baseModelId));
  return variants.filter(v => !older.has(modelKey(v.baseModelId)));
}

/** 후보 파이프라인 1단계: 제외 계열 → 최신 버전만 → off-peak 단가 적용(실행 시각이 off-peak일 때만, 표기 플래그 포함). */
export function filterCandidates(variants: readonly ModelVariant[],
  overrides: Readonly<Record<string, OffPeakRate>> = OFF_PEAK_RATES,
  nowUtc?: string): ModelVariant[] {
  return variants.filter(v => !isExcludedModel(v.modelId) && !isExcludedModel(v.baseModelId)).map(v => {
    const rate = findOffPeakRate(v.modelId, overrides) ?? findOffPeakRate(v.baseModelId, overrides);
    if (!rate) return v;
    if (nowUtc !== undefined && !isOffPeakHour(nowUtc, rate.provider)) return v;
    const blendedCost = calcBlendedCost(rate.input, rate.output);
    if (blendedCost === undefined) return v;
    const multiplier = v.blendedCost && v.effectiveCost !== undefined ? v.effectiveCost / v.blendedCost : 1;
    const effectiveCost = blendedCost * multiplier, costEfficiency = calcCostEfficiency(v.value, effectiveCost);
    return { ...v, blendedCost, effectiveCost, ...(costEfficiency !== undefined && { costEfficiency }), offPeak: true };
  });
}
