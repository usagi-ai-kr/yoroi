import { calcBlendedCost, effortForModel, splitBaseAndEffort } from './letter-top10-group.js';
import { COGNITION_COST_METRIC, COGNITION_DURATION_METRIC, COGNITION_METRIC, FREE_ACCESS_METRIC, normalizeModelName,
  type Top10RecordInput } from './letter-top10-rank.js';
import type { OptimalZoneRole } from './letter-top10-worker.js';
import { ORCHESTRATOR_EFFORT_ORDER } from './letter-top10-score-policy.js';

/** p54 score core 원값 수집. 성능·토큰은 base 최선값, 속도·가격·Cognition 시간·비용은 effort별로 모아 대표 effort가 정해진 뒤 역할별로 고른다. */
export const ROLE_AA_METRIC: Readonly<Record<OptimalZoneRole, string>> = {
  orchestrator: 'artificial_analysis_intelligence_index', worker: 'artificial_analysis_coding_index' };
export interface Raw { aaPerf?: number | undefined; cogCorrect?: number | undefined; or?: number; ocd?: number; aaSpeed?: number | undefined; cogDuration?: number | undefined;
  aaPrice?: number | undefined; cogCost?: number | undefined; free?: boolean; aaEffort?: Map<string, number>; cogEffort?: Map<string, number>;
  aaSpeedE?: Map<string, number>; aaPriceE?: Map<string, number>; cogDurE?: Map<string, number>; cogCostE?: Map<string, number> }
const SPEED = 'median_output_tokens_per_second', OR = 'total_tokens', OCD = 'opencode_data_tokens';
export const baseOf = (id: string): string => normalizeModelName(splitBaseAndEffort(id).base);
export const best = (m?: ReadonlyMap<string, number>) => m && [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
const hi = (a: number | undefined, b: number) => a === undefined ? b : Math.max(a, b);
const putMax = (m: Map<string, number>, effort: string, v: number) => m.set(effort, Math.max(m.get(effort) ?? v, v));
const putMin = (m: Map<string, number>, effort: string, v: number) => m.set(effort, Math.min(m.get(effort) ?? v, v));

export function collect(pool: readonly Top10RecordInput[], role: OptimalZoneRole): Map<string, Raw> {
  const out = new Map<string, Raw>();
  for (const r of pool) {
    const v = r.value, base = baseOf(r.modelId), x = out.get(base) ?? out.set(base, {}).get(base)!, effort = effortForModel(r.modelId, r.modelAlias);
    const cost = calcBlendedCost(r.priceInput, r.priceOutput);
    if (cost !== undefined && r.metric !== OR && r.metric !== OCD) putMin(x.aaPriceE ??= new Map(), effort, cost);
    if (r.metric === FREE_ACCESS_METRIC) x.free = true;
    if (v === undefined || !Number.isFinite(v) || v < 0) continue;
    if (r.metric === ROLE_AA_METRIC[role]) { x.aaPerf = hi(x.aaPerf, v); putMax(x.aaEffort ??= new Map(), effort, v); }
    else if (r.metric === COGNITION_METRIC && v <= 1) { x.cogCorrect = hi(x.cogCorrect, v); putMax(x.cogEffort ??= new Map(), effort, v); }
    else if (r.metric === OR && v > 0) x.or = hi(x.or, v); // 토큰 0은 사용 근거가 아니다(log10 붕괴 방지)
    else if (r.metric === OCD && v > 0) x.ocd = hi(x.ocd, v);
    else if (r.metric === SPEED && v > 0) putMax(x.aaSpeedE ??= new Map(), effort, v);
    else if (r.metric === COGNITION_DURATION_METRIC && v > 0) putMin(x.cogDurE ??= new Map(), effort, v);
    else if (r.metric === COGNITION_COST_METRIC) putMin(x.cogCostE ??= new Map(), effort, v);
  }
  return out;
}
export const hasEvidence = (r: Raw): boolean => r.free === true || r.aaPerf !== undefined || r.cogCorrect !== undefined || r.or !== undefined ||
  r.ocd !== undefined || [r.aaSpeedE, r.aaPriceE, r.cogDurE, r.cogCostE].some(m => !!m?.size);
/** base 공통 값: 2개 이상 effort의 관측값이 모두 같거나(예: API 단가), effort 구분 없는 단일 관측('default')뿐일 때. 그 외 undefined. */
const common = (m?: ReadonlyMap<string, number>) => m?.size && new Set(m.values()).size === 1 && (m.size > 1 || m.has('default')) ? [...m.values()][0] : undefined;
const extreme = (m: ReadonlyMap<string, number> | undefined, f: (...v: number[]) => number) => m?.size ? f(...m.values()) : undefined;
/** p58 정정 오케 평가 변형: 성능 소스(AA Intelligence·Cog 정답률)에서 관측된 effort(순서 안의 것, 낮은 순).
 *  순서 안 effort가 없으면(전부 default·관측 없음) default 단일 변형이다. default는 다른 effort가 있으면 변형이 아니고 공유 근거로만 쓴다. */
export function orchestratorVariants(r: Raw): string[] {
  const seen = new Set([...(r.aaEffort?.keys() ?? []), ...(r.cogEffort?.keys() ?? [])]);
  const ranked = ORCHESTRATOR_EFFORT_ORDER.filter(e => seen.has(e));
  return ranked.length ? [...ranked] : ['default'];
}
/** 오케: 변형 effort 값만 쓴다. 소스에 그 값이 없으면 base 공통 값(2개 이상 effort 동일 또는 단일 default)만 공유하고 그 외는 결측.
 *  성능·속도 모두 같은 effort다(p58 정정; p75: 오케 가성비 제거, 단가는 파레토·표시용으로만 남는다). 워커: 승인 정의대로 AA 속도 최대·단가 최소(base best), 성능은 base 최선값. */
export function pickEffortValues(r: Raw, effort: string, role: OptimalZoneRole): void {
  if (role === 'worker') { r.aaSpeed = extreme(r.aaSpeedE, Math.max); r.aaPrice = extreme(r.aaPriceE, Math.min); return; }
  const at = (m?: ReadonlyMap<string, number>) => m?.get(effort) ?? common(m);
  r.aaPerf = at(r.aaEffort); r.cogCorrect = at(r.cogEffort); r.aaSpeed = at(r.aaSpeedE); r.aaPrice = at(r.aaPriceE);
  r.cogDuration = at(r.cogDurE); r.cogCost = at(r.cogCostE);
}
