import type { ModelGroup } from './letter-top10-group.js';
/** 최적 존 임계와 역할별 단일 종합 점수 가중치. usage는 OpenRouter 사용량 우선, 미측정이면 OpenCode Data 토큰 보조(2026-10-13 사용자 지시). */
export const OPTIMAL_ZONE_THRESHOLDS = { orchestrator: 0.85, worker: 0.60 } as const;
/** Legacy heuristic weights; release uses ROLE_DIMENSION_WEIGHTS/SCORE_WEIGHTS instead. */
export const ROLE_SCORE_WEIGHTS: Readonly<Record<OptimalZoneRole, { index: number; cost: number; usage: number; speed: number }>> = {
  orchestrator: { index: 0.40, cost: 0.40, usage: 0.15, speed: 0.05 },
  worker: { index: 0.30, cost: 0.40, usage: 0.10, speed: 0.20 },
};
export type OptimalZoneRole = keyof typeof OPTIMAL_ZONE_THRESHOLDS;
export interface ScoreComponents { readonly index: number; readonly cost: number; readonly usage: number; readonly speed: number; readonly cognition?: number; readonly sources?: Readonly<Partial<Record<string, number>>>; readonly dimensionSources?: Readonly<Partial<Record<string, string>>>; readonly bonus?: number; readonly priceFallback?: boolean }
export interface ScoredGroup {
  readonly group: ModelGroup; readonly indexRank: number; readonly costEffRank: number;
  readonly score: number; readonly components: ScoreComponents; readonly belowZone: boolean;
}

export function computeRanks(values: (number | undefined)[], higherIsBetter = true): (number | undefined)[] {
  const defined = values.map((v, idx) => ({ v, idx })).filter((x): x is { v: number; idx: number } => Number.isFinite(x.v));
  if (!defined.length) return values.map(() => undefined);
  defined.sort((a, b) => higherIsBetter ? b.v - a.v : a.v - b.v);
  const result: (number | undefined)[] = new Array(values.length).fill(undefined); let rank = 1;
  for (let i = 0; i < defined.length; i++) {
    if (i > 0 && defined[i]!.v !== defined[i - 1]!.v) rank = i + 1;
    result[defined[i]!.idx] = rank;
  }
  return result;
}

function normalize(values: readonly (number | undefined)[], lowerIsBetter = false): number[] {
  const known = values.filter((v): v is number => Number.isFinite(v));
  if (!known.length) return values.map(() => 0);
  const min = Math.min(...known), max = Math.max(...known);
  return values.map(v => !Number.isFinite(v) ? 0 : max === min ? 1 :
    (lowerIsBetter ? 1 - (v! - min) / (max - min) : (v! - min) / (max - min)));
}
const logPositive = (v?: number): number | undefined => Number.isFinite(v) && v! >= 0
  ? Math.log10(Math.max(v!, Number.MIN_VALUE)) : undefined;
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
function scoreGroups(groups: readonly ModelGroup[], role: OptimalZoneRole | 'messenger'): { score: number; components: ScoreComponents }[] {
  const index = normalize(groups.map(g => g.repVariant.indexMissing ? undefined : g.repVariant.value));
  const cost = normalize(groups.map(g => { const c = g.repVariant.effectiveCost ?? g.repVariant.blendedCost;
    return c !== undefined && c >= 0 ? Math.log10(c + 0.01) : undefined; }), true);
  const usage = normalize(groups.map(g => logPositive(g.repVariant.openrouterTokens ?? g.repVariant.opencodeTokens)));
  const speeds = groups.map(g => g.repVariant.outputTokensPerSecond).filter((v): v is number => Number.isFinite(v) && v! >= 0);
  const speedLogs = groups.map(g => logPositive(g.repVariant.outputTokensPerSecond));
  const knownSpeed = normalize(speedLogs), speedMedian = speeds.length
    ? normalize([...speedLogs, logPositive(median(speeds))])[groups.length]! : 0.5;
  const speed = speedLogs.map((v, i) => v === undefined ? speedMedian : knownSpeed[i]!);
  return groups.map((group, i) => {
    const components = { index: index[i]!, cost: cost[i]!, usage: usage[i]!, speed: speed[i]! }, w = ROLE_SCORE_WEIGHTS[role === 'messenger' ? 'worker' : role];
    return { components, score: 100 * (w.index * components.index + w.cost * components.cost +
      w.usage * components.usage + w.speed * components.speed) };
  });
}

function chooseRepresentatives(groups: readonly ModelGroup[], role: OptimalZoneRole | 'messenger'): ModelGroup[] {
  const variants = groups.flatMap(g => g.variants.map(repVariant => ({ ...g, repVariant })));
  const scores = scoreGroups(variants, role), best = new Map<string, { group: ModelGroup; score: number }>();
  variants.forEach((group, i) => {
    const previous = best.get(group.baseModelId), score = scores[i]!.score;
    if (!previous || score > previous.score || score === previous.score &&
      (group.repVariant.value > previous.group.repVariant.value || group.repVariant.value === previous.group.repVariant.value &&
        group.repVariant.effort.localeCompare(previous.group.repVariant.effort) < 0)) best.set(group.baseModelId, { group, score });
  });
  return groups.map(g => ({ ...g, repVariant: best.get(g.baseModelId)!.group.repVariant }));
}

function paretoGroups(groups: readonly ModelGroup[]): ModelGroup[] {
  const costOf = (g: ModelGroup) => g.repVariant.effectiveCost ?? g.repVariant.blendedCost;
  return groups.map(g => {
    const c = g.repVariant, cost = costOf(g), dominated = groups.some(o => {
      const otherCost = costOf(o);
      if (o.baseModelId === g.baseModelId || o.repVariant.indexMissing || otherCost === undefined || cost === undefined) return false;
      return otherCost <= cost && o.repVariant.value >= c.value &&
        (otherCost < cost || o.repVariant.value > c.value);
    });
    return { ...g, isPareto: cost !== undefined && !c.indexMissing && !dominated };
  });
}

/** 임계 통과 그룹만 종합 점수 내림차순으로 반환한다(채우기 없음). 파레토는 단가·지수 별도 판정이다. */
export function selectOptimalZone(groups: readonly ModelGroup[], role: OptimalZoneRole | 'messenger'): ScoredGroup[] { return scoreRoleCandidates(groups, role).filter(g => !g.belowZone); }
export function selectRoleCandidates(groups: readonly ModelGroup[], role: OptimalZoneRole | 'messenger', limit = 10): ScoredGroup[] { return scoreRoleCandidates(groups, role).slice(0, limit); }
const fillOrder = (a: ScoredGroup, b: ScoredGroup): number => {
  const maxIndex = (g: ScoredGroup) => Math.max(...g.group.variants.filter(v => !v.indexMissing).map(v => v.value), Number.NEGATIVE_INFINITY);
  return Number(!!a.group.repVariant.indexMissing) - Number(!!b.group.repVariant.indexMissing) ||
    (a.group.repVariant.indexMissing ? b.score - a.score : maxIndex(b) - maxIndex(a) || b.score - a.score) || a.group.baseModelId.localeCompare(b.group.baseModelId);
};
function scoreRoleCandidates(groups: readonly ModelGroup[], role: OptimalZoneRole | 'messenger'): ScoredGroup[] {
  if (!groups.length) return []; const representatives = chooseRepresentatives(groups, role);
  const cutoff = Math.max(0, ...representatives.filter(g => !g.repVariant.indexMissing).map(g => g.repVariant.value)) * OPTIMAL_ZONE_THRESHOLDS[role === 'messenger' ? 'worker' : role];
  const kept = paretoGroups(representatives), scores = scoreGroups(kept, role);
  const indexRanks = computeRanks(kept.map(g => g.repVariant.indexMissing ? undefined : g.repVariant.value)), costRanks = computeRanks(kept.map(g => g.repVariant.indexMissing ? undefined : g.repVariant.costEfficiency));
  return kept.map((group, i) => ({ group, belowZone: !!group.repVariant.indexMissing || group.repVariant.value < cutoff,
    indexRank: indexRanks[i] ?? 0, costEffRank: costRanks[i] ?? 0,
    ...scores[i]! })).sort((a, b) => Number(a.belowZone) - Number(b.belowZone) ||
      (a.belowZone ? fillOrder(a, b) : b.score - a.score || b.group.repVariant.value - a.group.repVariant.value || a.group.baseModelId.localeCompare(b.group.baseModelId)));
}
