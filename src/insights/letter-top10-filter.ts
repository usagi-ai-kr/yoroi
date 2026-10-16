import { calcBlendedCost, calcCostEfficiency, type ModelVariant } from './letter-top10-group.js';
import { normalizeModelName } from './model-id.js';
import { DEFAULT_LETTER_MODEL_LISTS, isProtectedPair } from './letter-model-lists.js';
import { findOffPeakRate, isOffPeakHour, OFF_PEAK_RATES, type OffPeakRate } from './model-price-overrides.js';

/** 사용자 규칙 제외 계열(기본값, 설정으로 변경 가능): Fable·Astra. */
export const EXCLUDED_PATTERNS: readonly string[] = DEFAULT_LETTER_MODEL_LISTS.excludePatterns;

export function isExcludedModel(modelId: string, patterns: readonly string[] = EXCLUDED_PATTERNS): boolean {
  const id = normalizeModelName(modelId);
  return patterns.some(pattern => id.includes(pattern.toLowerCase()));
}

/** 연속 숫자 토큰을 버전으로 파싱(예 claude-opus-5-5 → claude-opus [5,5]). family 비면 null. */
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
export const separateGptSolModels = (a: string, b: string, allowOlder: readonly string[] = DEFAULT_LETTER_MODEL_LISTS.allowOlder): boolean =>
  isProtectedPair(a, b, allowOlder);
const isGptGrade = (family: string): boolean => {
  const parts = family.split('-');
  return parts[0] === 'gpt' && (GRADE_TOKENS as readonly string[]).includes(parts.at(-1)!);
};
type Parsed = { id: string; pv: NonNullable<ReturnType<typeof parseFamilyVersion>> };
/** 같은 family는 전체 버전, GPT 등급끼리는 메이저, 등록된 기본형→등급은 전체 버전(화이트리스트 older 보호). */
function supersedes(newer: Parsed, older: Parsed, allow: ReadonlySet<string>): boolean {
  if (newer.pv.family === older.pv.family) {
    if (allow.has(older.id)) return false;
    return compareVersions(newer.pv.version, older.pv.version) > 0;
  }
  if (isGptGrade(newer.pv.family) && isGptGrade(older.pv.family) && vendorLine(newer.pv.family) === vendorLine(older.pv.family) &&
    (newer.pv.version[0] ?? 0) > (older.pv.version[0] ?? 0)) return true;
  if (isGptGrade(older.pv.family)) return false;
  const grades = BASE_MODEL_GRADES[older.pv.family];
  const parts = newer.pv.family.split('-');
  return grades?.includes(parts.at(-1)!) === true &&
    parts.slice(0, -1).join('-') === older.pv.family && compareVersions(newer.pv.version, older.pv.version) > 0;
}
/** 전체 접근 가능 AA 모델 집합에서 같은 등급은 전체 버전, GPT 교차 등급은 메이저 세대를 비교한다.
 *  allowOlder 목록은 세대 비교·후속 규칙 어느 쪽으로도 superseded되지 않는다. */
export function olderGenerationModelIds(modelIds: readonly string[],
  allowOlder: readonly string[] = DEFAULT_LETTER_MODEL_LISTS.allowOlder): ReadonlySet<string> {
  const allow = new Set(allowOlder.map(modelKey));
  const ok = modelIds.map(id => ({ id: modelKey(id), pv: parseFamilyVersion(modelKey(id)) })).filter((x): x is Parsed => x.pv !== null);
  const older = new Set(ok.filter(x => ok.some(y => supersedes(y, x, allow))).map(x => x.id));
  for (const id of allow) older.delete(id);
  return older;
}

/** 같은 family의 낮은 버전 및 더 낮은 GPT 메이저를 제외한다. 파싱 불가·동일 세대는 유지한다. */
export function dropOlderVersions(variants: readonly ModelVariant[]): ModelVariant[] {
  const older = olderGenerationModelIds(variants.map(v => v.baseModelId));
  return variants.filter(v => !older.has(modelKey(v.baseModelId)));
}

/** 후보 파이프라인 1단계: 제외 계열 → 최신 버전만 → off-peak 단가(실행 시각이 off-peak일 때만). */
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
