import type { ModelGroup, ModelVariant } from './letter-top10-group.js';
import { filterCandidates } from './letter-top10-filter.js';
import { normalizeModelName, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
import { best, collect, hasEvidence, orchestratorVariants, pickEffortValues, type Raw } from './letter-top10-score-raw.js';
import { OPTIMAL_ZONE_THRESHOLDS, type OptimalZoneRole, type ScoredGroup } from './letter-top10-worker.js';
import { MODEL_SUCCESSORS } from './model-successors.js';
import { ORCHESTRATOR_EFFORT_ORDER, PERFORMANCE_FLOOR, PRICE_MISSING, ROLE_DIMENSION_WEIGHTS, ROLE_SOURCES, SCORE_DIMENSIONS,
  type ScoreDimension, type ScoreSource } from './letter-top10-score-policy.js';
export * from './letter-top10-score-policy.js';
export { ROLE_AA_METRIC } from './letter-top10-score-raw.js';

/** p54(2026-10-14 사용자 승인 C): 4차원(성능·사용량·속도·가격)을 역할별 가중치로 합산한다(결측 차원 0, 재분배 없음).
 *  각 소스는 역할 후보 풀 전체에서 min-max 표준화하고 같은 차원 안에서 높은 값을 쓴다. 차원별 소스는 ROLE_SOURCES.
 *  성능=AA 역할 지표(오케·리뷰어 Intelligence, 워커·메신저 Coding)·Cognition 정답률, 사용량=OR·OCD 토큰(log10).
 *  오케: 속도=AA 토큰/s·Cognition 소요 분. p58 정정: 관측 effort 변형마다 성능·속도를 그 effort 값으로 매기고
 *  (없으면 base 공통 값만 공유, 그 외 결측) 전 변형 풀로 표준화한 뒤 점수 최고 변형을 대표로 쓴다. 워커: 속도=AA 토큰/s 최대만, 가격=AA 혼합 단가 최소만, 표준화 후 성능 < 0.70 제외.
 *  가격 근거가 모두 없으면 0.99(풀 전체 무가격이면 0). Free 경로는 접근 근거일 뿐 가격을 바꾸지 않는다.
 *  p75 확정: 오케 가성비 제거 — 오케 가중치 성능 0.82·사용량 0.06·속도 0.12(70:5:10 비례 재배분), effort 상한 없음(max·xhigh 유지).
 *  오케 단가는 파레토·표시용이며 스코어에 쓰지 않는다. */
const safeLog = (c: number): number => Math.log10(c + 0.01);
/** 차원별 소스·방향(low=낮을수록 좋음)·log 변환. 단위가 다른 원값은 섞지 않고 소스마다 따로 표준화한다. */
const PARTS: readonly { dim: ScoreDimension; src: ScoreSource; key: keyof Raw; low?: boolean; log?: (v: number) => number; role?: OptimalZoneRole }[] = [
  { dim: 'performance', src: 'aa', key: 'aaPerf' }, { dim: 'performance', src: 'cognition', key: 'cogCorrect' },
  { dim: 'usage', src: 'openrouter', key: 'or', log: Math.log10 }, { dim: 'usage', src: 'opencode', key: 'ocd', log: Math.log10 },
  { dim: 'speed', src: 'aa', key: 'aaSpeed' }, { dim: 'speed', src: 'cognition', key: 'cogDuration', low: true },
  { dim: 'price', src: 'aa', key: 'aaPrice', low: true, log: safeLog, role: 'worker' }, { dim: 'price', src: 'cognition', key: 'cogCost', low: true, log: safeLog, role: 'worker' }]; // p75: 오케 price(가성비) 부품 없음
const minMax = (values: readonly (number | undefined)[], low = false): (number | undefined)[] => {
  const known = values.filter((v): v is number => v !== undefined), min = Math.min(...known), max = Math.max(...known);
  return values.map(v => v === undefined ? undefined : max === min ? 1 : low ? (max - v) / (max - min) : (v - min) / (max - min));
};

/** 역할별 전체 후보(Top10 컷 전): 임계(최고 × 0.85/0.75) 통과 먼저, 미달 보충도 스코어순, 동점은 모델명.
 *  추천 effort: 오케는 p58 정정 변형별 P1 점수 최고(동점 낮은 effort), 워커는 성능 차원을 낸 소스(동점 AA)의 최고 effort. 파레토는 실제 단가 대비 스코어. */
export function scoreRoleCandidatesFromSources(pool: readonly Top10RecordInput[], role: OptimalZoneRole, opts?: Top10Options): ScoredGroup[] {
  const collected = collect(pool, role), has = (b: string) => { const r = collected.get(b); return !!r && hasEvidence(r); };
  const superseded = new Set(MODEL_SUCCESSORS.filter(m => has(normalizeModelName(m.successor))).map(m => normalizeModelName(m.predecessor)));
  const raws = [...collected].filter(([base, r]) => hasEvidence(r) && !superseded.has(base)).map(([, r]) => r);
  const bases = [...collected].filter(([base, r]) => hasEvidence(r) && !superseded.has(base)).map(([base]) => base);
  const parts = PARTS.filter(p => ROLE_SOURCES[role][p.dim].includes(p.src) && (p.role ?? role) === role), w = ROLE_DIMENSION_WEIGHTS[role], floor = PERFORMANCE_FLOOR[role];
  const stdOf = (rs: readonly Raw[], p: typeof PARTS[number]) => minMax(rs.map(r => { const v = r[p.key] as number | undefined; return v === undefined ? undefined : p.log ? p.log(v) : v; }), p.low);
  // 워커: 성능 소스(동점 AA)의 최고 effort 하나. 오케(p58 정정): 관측 effort 변형마다 그 effort 값을 고른 행을 만들어 전 변형 풀로 표준화한다.
  const [perfAa, perfCog] = role === 'worker' ? [PARTS[0]!, PARTS[1]!].map(p => stdOf(raws, p)) : [];
  const rows = raws.flatMap((r, i) => role === 'orchestrator'
    ? orchestratorVariants(r).map(effort => { const c = { ...r }; pickEffortValues(c, effort, role); return { r: c, base: bases[i]!, effort }; })
    : [(() => { const a = perfAa![i], c = perfCog![i];
      const m = a === undefined && c === undefined ? undefined : c !== undefined && (a === undefined || c > a) ? r.cogEffort : r.aaEffort;
      const effort = best(m)?.[0] ?? 'default'; pickEffortValues(r, effort, role); return { r, base: bases[i]!, effort }; })()]);
  const std = parts.map(p => stdOf(rows.map(x => x.r), p)), anyPrice = rows.some(x => parts.some(p => p.dim === 'price' && x.r[p.key] !== undefined));
  const scored = rows.map(({ r, base, effort }, i) => {
    const sources: Record<string, number> = {}, dims: Partial<Record<ScoreDimension, number>> = {}, from: Record<string, string> = {};
    parts.forEach((p, j) => { const v = std[j]![i]; if (v === undefined) return; sources[`${p.dim}:${p.src}`] = v;
      if (dims[p.dim] === undefined || v > dims[p.dim]!) { dims[p.dim] = v; from[p.dim] = p.src; } });
    // 가격 결측 보정은 관측값이 아니므로 'price:missing'으로만 남긴다(원 단가 표시는 '-').
    const missing = PRICE_MISSING[role]; // 워커만 .99 보정(오케는 가격 차원 없음)
    if (dims.price === undefined && anyPrice && missing !== undefined) { sources['price:missing'] = dims.price = missing; from.price = 'missing'; }
    const score = 100 * SCORE_DIMENSIONS.reduce((sum, d) => sum + (w[d] ?? 0) * (dims[d] ?? 0), 0), aa = role === 'orchestrator' ? r.aaPerf : r.aaEffort?.get(effort) ?? best(r.aaEffort)?.[1];
    const variant: ModelVariant = { modelId: effort === 'default' ? base : `${base}-${effort}`, baseModelId: base, effort, value: aa ?? 0,
      ...(aa === undefined && { indexMissing: true }), ...(r.aaPrice !== undefined && { blendedCost: r.aaPrice }),
      ...(r.or !== undefined && { openrouterTokens: r.or }), ...(r.ocd !== undefined && { opencodeTokens: r.ocd }),
      ...(r.aaSpeed !== undefined && { outputTokensPerSecond: r.aaSpeed }), ...(r.cogCorrect !== undefined && { cognitionCorrect: r.cogCorrect }) };
    return { variant, score, dims, sources, from };
  });
  // 오케 대표 변형 = 점수 최고(동점 낮은 effort). 워커는 행이 모델당 하나다. 워커 하한 탈락자는 보충·임계·파레토에서도 제외.
  const rank = (e: string) => ORCHESTRATOR_EFFORT_ORDER.indexOf(e as typeof ORCHESTRATOR_EFFORT_ORDER[number]);
  const top = new Map<string, typeof scored[number]>();
  for (const x of scored) { const cur = top.get(x.variant.baseModelId);
    if (!cur || x.score > cur.score || (x.score === cur.score && rank(x.variant.effort) < rank(cur.variant.effort))) top.set(x.variant.baseModelId, x); }
  const items = [...top.values()].filter(s => floor === undefined || (s.dims.performance ?? 0) >= floor);
  const kept = new Map(filterCandidates(items.map(s => s.variant), opts?.priceOverrides, opts?.nowUtc).map(v => [v.baseModelId, v]));
  const live = items.flatMap(s => kept.has(s.variant.baseModelId) ? [{ ...s, variant: kept.get(s.variant.baseModelId)! }] : []);
  const cutoff = Math.max(0, ...live.map(s => s.score)) * OPTIMAL_ZONE_THRESHOLDS[role];
  const costOf = (s: typeof live[number]) => s.variant.effectiveCost ?? s.variant.blendedCost;
  return live.map(s => {
    const c = costOf(s), dominated = live.some(o => o !== s && c !== undefined && costOf(o) !== undefined && costOf(o)! <= c && o.score >= s.score && (costOf(o)! < c || o.score > s.score));
    const group: ModelGroup = { baseModelId: s.variant.baseModelId, repVariant: s.variant, variants: [s.variant], isPareto: c !== undefined && !dominated };
    return { group, indexRank: 0, costEffRank: 0, score: s.score, belowZone: s.score < cutoff,
      components: { index: s.dims.performance ?? 0, cost: s.dims.price ?? 0, usage: s.dims.usage ?? 0, speed: s.dims.speed ?? 0,
        sources: s.sources, dimensionSources: s.from } };
  }).sort((a, b) => Number(a.belowZone) - Number(b.belowZone) || b.score - a.score || a.group.baseModelId.localeCompare(b.group.baseModelId));
}
