import type { ModelGroup, ModelVariant } from './letter-top10-group.js';
import { filterCandidates } from './letter-top10-filter.js';
import { normalizeModelName, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
import { bestWithinCap, capWorkerPerf, collect, hasEvidence, orchestratorVariants, pickEffortValues, workerCognitionSpeed, type Raw } from './letter-top10-score-raw.js';
import { OPTIMAL_ZONE_THRESHOLDS, type OptimalZoneRole, type ScoredGroup } from './letter-top10-worker.js';
import { MODEL_SUCCESSORS } from './model-successors.js';
import { ORCHESTRATOR_EFFORT_ORDER, PERFORMANCE_FLOOR, PRICE_MISSING, ROLE_DIMENSION_WEIGHTS, ROLE_SOURCES, SCORE_DIMENSIONS, WORKER_INTEL_FLOOR, type ScoreDimension, type ScoreSource } from './letter-top10-score-policy.js';
import { WORKER_BONUS_CAP } from './letter-top10-score-weights.js';
import { capOfModel } from './letter-effort-availability.js';
import { applyMixedPriceCap, upliftHeldPlanPriceDimensions } from './letter-top10-worker-price.js';
export * from './letter-top10-score-policy.js'; export { ROLE_AA_METRIC } from './letter-top10-score-raw.js';
/** 역할별 가중합·후보 풀 min-max. R(1.2.1) 오케 0.75/0/0.10/0.15; 워커 속도는 AA 우선, 결측이면 오케 Cog 시간. */
const safeLog = (c: number): number => Math.log10(c + 0.01);
const PARTS: readonly { dim: ScoreDimension; src: ScoreSource; key: keyof Raw; low?: boolean; log?: (v: number) => number; role?: OptimalZoneRole }[] = [
  { dim: 'performance', src: 'aa', key: 'aaPerf' }, { dim: 'performance', src: 'cognition', key: 'cogCorrect' },
  { dim: 'usage', src: 'openrouter', key: 'or', log: Math.log10 }, { dim: 'usage', src: 'opencode', key: 'ocd', log: Math.log10 },
  { dim: 'speed', src: 'aa', key: 'aaSpeed' }, { dim: 'speed', src: 'cognition', key: 'cogDuration', low: true },
  { dim: 'price', src: 'aa', key: 'aaPrice', low: true, log: safeLog, role: 'worker' }, { dim: 'price', src: 'cognition', key: 'cogCost', low: true, log: safeLog, role: 'worker' },
  { dim: 'price', src: 'aa', key: 'aaCpt', low: true, log: safeLog, role: 'worker' }, { dim: 'price', src: 'aa', key: 'aaTotal', low: true, log: safeLog, role: 'worker' },
  { dim: 'price', src: 'aa', key: 'orchValue', log: Math.log10, role: 'orchestrator' }, { dim: 'price', src: 'cognition', key: 'cogCost', low: true, log: safeLog, role: 'orchestrator' }]; // R 오케 가성비: AA log10(I/(P+.01)) 정방향·Cog USD/task 역방향, 차원 max
const minMax = (values: readonly (number | undefined)[], low = false): (number | undefined)[] => {
  const known = values.filter((v): v is number => v !== undefined), min = Math.min(...known), max = Math.max(...known);
  return values.map(v => v === undefined ? undefined : max === min ? 1 : low ? (max - v) / (max - min) : (v - min) / (max - min));
};
/** 역할별 전체 후보(Top10 컷 전): 임계 통과 먼저·미달 보충은 스코어순·동점은 모델명. 파레토는 실제 단가 대비 스코어. */
export function scoreRoleCandidatesFromSources(pool: readonly Top10RecordInput[], role: OptimalZoneRole, opts?: Top10Options): ScoredGroup[] {
  const collected = collect(pool, role), has = (b: string) => { const r = collected.get(b); return !!r && hasEvidence(r); };
  const superseded = new Set(MODEL_SUCCESSORS.filter(m => has(normalizeModelName(m.successor))).map(m => normalizeModelName(m.predecessor)));
  const evidenced = ([base, r]: [string, Raw]) => hasEvidence(r) && !superseded.has(base) || (role === 'worker' && !superseded.has(base) && (!!r.aaCptE?.size || !!r.aaTotalE?.size));
  const bases = [...collected].filter(evidenced).map(([base]) => base);
  // cap 이 있는 모델만 상한을 적용한다. cap 없는 모델은 관측 effort 를 그대로 쓴다(표기만 plain).
  const capOf = (i: number) => capOfModel(bases[i]!, opts?.effortAvailability);
  const raws = [...collected].filter(evidenced).map(([, r], i) => role === 'worker' ? capWorkerPerf(r, capOf(i)) : r);
  const parts = PARTS.filter(p => ROLE_SOURCES[role][p.dim].includes(p.src) && (p.role ?? role) === role), w = ROLE_DIMENSION_WEIGHTS[role], floor = PERFORMANCE_FLOOR[role];
  const stdOf = (rs: readonly Raw[], p: typeof PARTS[number]) => minMax(rs.map(r => { const v = r[p.key] as number | undefined; return v === undefined ? undefined : p.log ? p.log(v) : v; }), p.low);
  const [perfAa, perfCog] = role === 'worker' ? [PARTS[0]!, PARTS[1]!].map(p => stdOf(raws, p)) : [];
  const rows = raws.flatMap((r, i) => role === 'orchestrator'
    ? orchestratorVariants(r, capOf(i)).map(effort => { const c = { ...r }; pickEffortValues(c, effort, role, capOf(i)); return { r: c, base: bases[i]!, effort }; })
    : [(() => { const a = perfAa![i], c = perfCog![i];
      const m = a === undefined && c === undefined ? undefined : c !== undefined && (a === undefined || c > a) ? r.cogEffort : r.aaEffort;
      const chosen = bestWithinCap(m, capOf(i))?.[0] ?? 'default', effort = r.aaEffort?.has(chosen) ? chosen : bestWithinCap(r.aaEffort, capOf(i))?.[0] ?? chosen; pickEffortValues(r, effort, role, capOf(i)); return { r, base: bases[i]!, effort }; })()]);
  const workerCogSpeed = role === 'worker' ? workerCognitionSpeed(raws, rows.map(x => x.effort), rows.map((_, i) => capOf(i))) : [];
  const genericParts = role === 'worker' ? parts.filter(p => p.dim !== 'price') : parts;
  const std = genericParts.map(p => stdOf(rows.map(x => x.r), p)), anyPrice = rows.some(x => parts.some(p => p.dim === 'price' && x.r[p.key] !== undefined));
  const pricePart = (key: 'aaCpt' | 'aaTotal' | 'aaPrice') => PARTS.find(p => p.dim === 'price' && p.key === key && (key !== 'aaPrice' || p.role === 'worker'))!;
  const stdPrice = (key: 'aaCpt' | 'aaTotal' | 'aaPrice') => role === 'worker' ? stdOf(rows.map(x => x.r), pricePart(key)) : []; // p85 cpt·total·혼합 단가(대체재)
  const [stdCpt, stdTotal, stdBlend] = [stdPrice('aaCpt'), stdPrice('aaTotal'), stdPrice('aaPrice')];
  const baseWorkerPrices = rows.map((_, i) => { const values = [stdCpt[i], stdTotal[i]].filter((v): v is number => v !== undefined); return values.length ? values.reduce((a, v) => a + v, 0) / values.length : stdBlend[i] ?? (anyPrice ? PRICE_MISSING[role] : undefined); });
  const scored = rows.map(({ r, base, effort }, i) => {
    const sources: Record<string, number> = {}, dims: Partial<Record<ScoreDimension, number>> = {}, from: Record<string, string> = {};
    genericParts.forEach((p, j) => { const v = std[j]![i]; if (v === undefined) return; sources[`${p.dim}:${p.src}`] = v;
      if (role === 'worker' && p.dim === 'performance' && p.src === 'cognition') return; // p85 워커 성능=AA intel만, Cog는 가산 입력
      if (dims[p.dim] === undefined || v > dims[p.dim]!) { dims[p.dim] = v; from[p.dim] = p.src; } });
    if (role === 'worker' && dims.speed === undefined && workerCogSpeed[i] !== undefined) { dims.speed = workerCogSpeed[i]!; sources['speed:cognition'] = dims.speed; from.speed = 'cognition'; }
    // p85 워커 가격 = cpt·total 표준화값의 평균(단독·혼합 단가 대체+`*`). 가산 = cap×mean(Cog·사용량, 있는 것만).
    let bonus: number | undefined, priceFallback = false;
    if (role === 'worker') {
      const priced: [string, number][] = [];
      if (stdCpt[i] !== undefined) priced.push(['price:cpt', stdCpt[i] as number]);
      if (stdTotal[i] !== undefined) priced.push(['price:total', stdTotal[i] as number]);
      if (priced.length) { for (const [key, value] of priced) sources[key] = value; from.price = 'aa'; }
      else if (stdBlend[i] !== undefined) { sources['price:blended'] = stdBlend[i] as number; from.price = 'aa'; priceFallback = true; }
      if (baseWorkerPrices[i] !== undefined) { dims.price = baseWorkerPrices[i]!;
        if (!priced.length && stdBlend[i] === undefined) { sources['price:missing'] = PRICE_MISSING.worker!; from.price = 'missing'; } }
      const bonusInputs = [sources['performance:cognition'], dims.usage].filter((v): v is number => v !== undefined);
      if (bonusInputs.length) bonus = WORKER_BONUS_CAP * bonusInputs.reduce((sum, v) => sum + v, 0) / bonusInputs.length;
    }
    const missing = PRICE_MISSING[role]; // 가격 결측 보정은 'price:missing'으로만(워커 .99, 오케 가성비 결측은 0·보정 없음)
    if (dims.price === undefined && anyPrice && missing !== undefined) { sources['price:missing'] = dims.price = missing; from.price = 'missing'; }
    const score = 100 * SCORE_DIMENSIONS.reduce((sum, d) => sum + (w[d] ?? 0) * (dims[d] ?? 0), 0) + (bonus ?? 0),
      aa = role === 'orchestrator' ? r.aaPerf : r.aaEffort?.get(effort) ?? bestWithinCap(r.aaEffort, capOf(i))?.[1];
    const variant: ModelVariant = { modelId: effort === 'default' ? base : `${base}-${effort}`, baseModelId: base, effort, value: aa ?? 0,
      ...(aa === undefined && { indexMissing: true }), ...(r.aaPrice !== undefined && { blendedCost: r.aaPrice }),
      ...(r.or !== undefined && { openrouterTokens: r.or }), ...(r.ocd !== undefined && { opencodeTokens: r.ocd }),
      ...(r.aaSpeed !== undefined && { outputTokensPerSecond: r.aaSpeed }), ...(r.cogCorrect !== undefined && { cognitionCorrect: r.cogCorrect }) };
    return { variant, score, dims, sources, from, intel: r.aaPerf, bonus, priceFallback };
  });
  // 오케 대표 변형 = 점수 최고(동점 낮은 effort). 워커는 행이 모델당 하나다. p85 워커 하한=AA intel 원값 33(후보·▽ 모두, 없으면 제외).
  const rank = (e: string) => ORCHESTRATOR_EFFORT_ORDER.indexOf(e as typeof ORCHESTRATOR_EFFORT_ORDER[number]);
  const top = new Map<string, typeof scored[number]>();
  for (const x of scored) { const cur = top.get(x.variant.baseModelId);
    if (!cur || x.score > cur.score || (x.score === cur.score && rank(x.variant.effort) < rank(cur.variant.effort))) top.set(x.variant.baseModelId, x); }
  const items = [...top.values()].filter(s => role === 'worker'
    ? s.intel !== undefined && s.intel >= WORKER_INTEL_FLOOR
    : floor === undefined || (s.dims.performance ?? 0) >= floor);
  const kept = new Map(filterCandidates(items.map(s => s.variant), opts?.priceOverrides, opts?.nowUtc).map(v => [v.baseModelId, v]));
  const liveBase = items.flatMap(s => kept.has(s.variant.baseModelId) ? [{ ...s, variant: kept.get(s.variant.baseModelId)! }] : []);
  const uplifted = role === 'worker' ? upliftHeldPlanPriceDimensions(liveBase.map(s => s.variant.baseModelId), liveBase.map(s => s.dims.price)) : [];
  const live = role === 'worker' ? liveBase.map((s, i) => { const p = uplifted[i]; return p === undefined ? s : { ...s, score: s.score + 100 * (ROLE_DIMENSION_WEIGHTS.worker.price ?? 0) * (p - (s.dims.price ?? 0)), dims: { ...s.dims, price: p } }; }) : liveBase;
  const cutoff = Math.max(0, ...live.map(s => s.score)) * OPTIMAL_ZONE_THRESHOLDS[role];
  const costOf = (s: typeof live[number]) => s.variant.effectiveCost ?? s.variant.blendedCost;
  return applyMixedPriceCap(role, live.map(s => {
    const c = costOf(s), dominated = live.some(o => o !== s && c !== undefined && costOf(o) !== undefined && costOf(o)! <= c && o.score >= s.score && (costOf(o)! < c || o.score > s.score));
    const group: ModelGroup = { baseModelId: s.variant.baseModelId, repVariant: s.variant, variants: [s.variant], isPareto: c !== undefined && !dominated };
    return { group, indexRank: 0, costEffRank: 0, score: s.score, belowZone: s.score < cutoff,
      components: { index: s.dims.performance ?? 0, cost: s.dims.price ?? 0, usage: s.dims.usage ?? 0, speed: s.dims.speed ?? 0,
        sources: s.sources, dimensionSources: s.from, ...(s.bonus !== undefined && { bonus: s.bonus }),
        ...(s.priceFallback === true && { priceFallback: true }) } };
  }), live.map(s => s.variant.blendedCost)).sort((a, b) => Number(a.belowZone) - Number(b.belowZone) || b.score - a.score || a.group.baseModelId.localeCompare(b.group.baseModelId));
}
