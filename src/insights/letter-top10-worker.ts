import type { ModelGroup } from './letter-top10-group.js';

/** 최적 존 임계: 후보 최고 지수 대비 통과 비율(오케 85%, 워커 75%). 유일한 임계 상수. */
export const OPTIMAL_ZONE_THRESHOLDS = { orchestrator: 0.85, worker: 0.75 } as const;
export type OptimalZoneRole = keyof typeof OPTIMAL_ZONE_THRESHOLDS;

export interface ScoredGroup {
  readonly group: ModelGroup;
  readonly indexRank: number;
  readonly costEffRank: number;
  readonly orRank?: number;
}

export function computeRanks(values: (number | undefined)[], higherIsBetter = true): (number | undefined)[] {
  const defined = values.map((v, idx) => ({ v, idx })).filter((x): x is { v: number; idx: number } => Number.isFinite(x.v));
  if (!defined.length) return values.map(() => undefined);
  defined.sort((a, b) => higherIsBetter ? b.v - a.v : a.v - b.v);
  const result: (number | undefined)[] = new Array(values.length).fill(undefined);
  let rank = 1;
  for (let i = 0; i < defined.length; i++) {
    if (i > 0 && defined[i]!.v !== defined[i - 1]!.v) rank = i + 1;
    result[defined[i]!.idx] = rank;
  }
  return result;
}

/** 가성비 정렬: 무료(0) < 유가 < 단가 미상, 각 tier에서 가성비↓ → OR 사용량↑ → 속도↑ → 지수↓. */
function compareGroups(a: ScoredGroup, b: ScoredGroup): number {
  const ra = a.group.repVariant, rb = b.group.repVariant;
  const tier = (cost?: number) => cost === undefined ? 2 : cost === 0 ? 0 : 1;
  const ta = tier(ra.blendedCost), tb = tier(rb.blendedCost);
  if (ta !== tb) return ta - tb;
  const ea = ra.costEfficiency ?? Number.NEGATIVE_INFINITY, eb = rb.costEfficiency ?? Number.NEGATIVE_INFINITY;
  if (ea !== eb) return eb - ea;
  const oa = a.orRank ?? Number.POSITIVE_INFINITY, ob = b.orRank ?? Number.POSITIVE_INFINITY;
  if (oa !== ob) return oa - ob;
  const sa = ra.outputTokensPerSecond ?? Number.NEGATIVE_INFINITY, sb = rb.outputTokensPerSecond ?? Number.NEGATIVE_INFINITY;
  if (sa !== sb) return sb - sa;
  if (ra.value !== rb.value) return rb.value - ra.value;
  return a.group.baseModelId.localeCompare(b.group.baseModelId);
}

/** 임계 통과 그룹만, 가성비 정렬로 반환한다(채우기 없음 — 10개 미만이면 그대로). */
export function selectOptimalZone(groups: readonly ModelGroup[], role: OptimalZoneRole): ScoredGroup[] {
  if (!groups.length) return [];
  const cutoff = Math.max(...groups.map(g => g.repVariant.value)) * OPTIMAL_ZONE_THRESHOLDS[role];
  const kept = groups.filter(g => g.repVariant.value >= cutoff);
  const indexRanks = computeRanks(kept.map(g => g.repVariant.value), true);
  const orRanks = computeRanks(kept.map(g => g.repVariant.openrouterTokens), true);
  const sorted = kept.map((group, i) => ({ group, indexRank: indexRanks[i] ?? 1, costEffRank: 0,
    ...(orRanks[i] !== undefined && { orRank: orRanks[i] }) })).sort(compareGroups);
  let rank = 0, seen = 0, previousEff = Number.NaN;
  return sorted.map(s => {
    const eff = s.group.repVariant.costEfficiency;
    if (eff === undefined) return s;
    seen += 1;
    if (eff !== previousEff) { rank = seen; previousEff = eff; }
    return { ...s, costEffRank: rank };
  });
}
