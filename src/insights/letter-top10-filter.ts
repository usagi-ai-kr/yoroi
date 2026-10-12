import { calcBlendedCost, calcCostEfficiency, type ModelVariant } from './letter-top10-group.js';
import { findOffPeakRate, isOffPeakHour, OFF_PEAK_RATES, type OffPeakRate } from './model-price-overrides.js';

/** 사용자 규칙 제외 계열(소문자 부분 일치). Grok 제외 사유: 사용자 취향(docs/insights/top10-scoring.md). */
export const EXCLUDED_PATTERNS = ['fable', 'astra', 'grok'] as const;

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

/** 같은 계열에 더 높은 버전이 있으면 그보다 낮은 버전만 제외하고, 파싱 불가·동일 버전은 유지한다. */
export function dropOlderVersions(variants: readonly ModelVariant[]): ModelVariant[] {
  const parsed = variants.map(v => ({ v, pv: parseFamilyVersion(v.baseModelId) }));
  const maxByFamily = new Map<string, readonly number[]>();
  for (const { pv } of parsed) {
    if (!pv) continue;
    const current = maxByFamily.get(pv.family);
    if (!current || compareVersions(pv.version, current) > 0) maxByFamily.set(pv.family, pv.version);
  }
  return parsed.filter(({ pv }) => !pv || compareVersions(pv.version, maxByFamily.get(pv.family)!) >= 0).map(({ v }) => v);
}

/** 후보 파이프라인 1단계: 제외 계열 → 최신 버전만 → off-peak 단가 적용(실행 시각이 off-peak일 때만, 표기 플래그 포함). */
export function filterCandidates(variants: readonly ModelVariant[],
  overrides: Readonly<Record<string, OffPeakRate>> = OFF_PEAK_RATES,
  nowUtc?: string): ModelVariant[] {
  const kept = dropOlderVersions(variants.filter(v => !isExcludedModel(v.modelId) && !isExcludedModel(v.baseModelId)));
  return kept.map(v => {
    const rate = findOffPeakRate(v.modelId, overrides) ?? findOffPeakRate(v.baseModelId, overrides);
    if (!rate) return v;
    if (nowUtc !== undefined && !isOffPeakHour(nowUtc, rate.provider)) return v;
    const blendedCost = calcBlendedCost(rate.input, rate.output);
    if (blendedCost === undefined) return v;
    const costEfficiency = calcCostEfficiency(v.value, blendedCost);
    return { ...v, blendedCost, ...(costEfficiency !== undefined && { costEfficiency }), offPeak: true };
  });
}
