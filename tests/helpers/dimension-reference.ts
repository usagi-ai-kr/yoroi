import { effortForModel, splitBaseAndEffort } from '../../src/insights/letter-top10-group.js';
import { normalizeModelName } from '../../src/insights/model-id.js';

/** p64 독립 참조(core/policy 비참조): 오케 전 effort 변형 풀 표준화 후 최고 점수·동점 낮은 effort.
 * 소스 default 단일/전 effort 동일값만 공유. 오케 가중치 70/0/15/15, 가성비=max(AA I²/P, Cog USD/task).
 * 워커 base 최선 성능·AA 속도/단가, 전체 풀 표준화 후 .70 하한. */
export interface DimRow { readonly modelId: string; readonly modelAlias?: string; readonly metric?: string; readonly value?: number; readonly priceInput?: number; readonly priceOutput?: number }
export const DIMS = ['performance', 'usage', 'speed', 'price'] as const;
export type Dim = typeof DIMS[number];
export type Weights = Readonly<Record<Dim, number>>;
export type Role = 'orchestrator' | 'worker';
export const PRICE_MISSING = 0.99, WORKER_FLOOR = 0.70;
export const EQUAL_WEIGHTS: Weights = { performance: 0.25, usage: 0.25, speed: 0.25, price: 0.25 };
export const ROLE_WEIGHTS: Readonly<Record<Role, Weights>> = {
  orchestrator: { performance: 0.70, usage: 0.05, speed: 0.10, price: 0.15 }, worker: { performance: 0.30, usage: 0.20, speed: 0.10, price: 0.40 } };
export const SOURCES = ['aaPerf', 'cogCorrect', 'or', 'ocd', 'aaSpeed', 'cogDuration', 'aaPrice', 'cogCost'] as const;
export type Src = typeof SOURCES[number];
export const DIM_OF: Readonly<Record<Src, Dim>> = { aaPerf: 'performance', cogCorrect: 'performance', or: 'usage', ocd: 'usage', aaSpeed: 'speed', cogDuration: 'speed', aaPrice: 'price', cogCost: 'price' };
const ORDER = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const AA_PERF = { orchestrator: 'artificial_analysis_intelligence_index', worker: 'artificial_analysis_coding_index' } as const;
const SOURCE_OF: Readonly<Record<string, Src>> = { cognition_correct: 'cogCorrect', total_tokens: 'or', opencode_data_tokens: 'ocd', median_output_tokens_per_second: 'aaSpeed', cognition_duration_min: 'cogDuration', cognition_cost: 'cogCost' };
type Raw = Partial<Record<Src, number>>;
type Observed = Partial<Record<Src, Map<string, number>>>;
export interface DimScore { readonly modelId: string; readonly effort: string; readonly raw: Raw; readonly std: Raw;
  readonly dims: Record<Dim, number>; readonly dimSource: Partial<Record<Dim, Src | 'missing'>>; readonly contrib: Record<Dim, number>; readonly score: number }
export function referenceDimensions(rows: readonly DimRow[], role: Role, freeIds: ReadonlySet<string> = new Set(), weights: Weights = ROLE_WEIGHTS[role], floor = role === 'worker' ? WORKER_FLOOR : 0): DimScore[] {
  const models = new Map<string, Observed>(), orch = role === 'orchestrator';
  const put = (o: Observed, s: Src, e: string, v: number) => { const m = o[s] ??= new Map();
    m.set(e, ['aaPrice', 'cogDuration', 'cogCost'].includes(s) ? Math.min(m.get(e) ?? Infinity, v) : Math.max(m.get(e) ?? -Infinity, v)); };
  for (const r of rows) {
    const id = normalizeModelName(splitBaseAndEffort(r.modelId).base), e = effortForModel(r.modelId, r.modelAlias), v = r.value;
    const o = models.get(id) ?? models.set(id, {}).get(id)!;
    if (r.metric !== 'total_tokens' && r.metric !== 'opencode_data_tokens' && Number.isFinite(r.priceInput) && Number.isFinite(r.priceOutput) && r.priceInput! >= 0 && r.priceOutput! >= 0)
      put(o, 'aaPrice', e, (3 * r.priceInput! + r.priceOutput!) / 4);
    const s = r.metric === AA_PERF[role] ? 'aaPerf' : SOURCE_OF[r.metric ?? ''];
    if (!s || v === undefined || !Number.isFinite(v) || v < 0 || (s === 'cogCorrect' && v > 1) || (['or', 'ocd', 'aaSpeed', 'cogDuration'].includes(s) && v === 0)) continue;
    put(o, s, e, v);
  }
  for (const id of freeIds) if (!models.has(id)) models.set(id, {});
  for (const [id, o] of models) if (!Object.values(o).some(m => m?.size) && !freeIds.has(id)) models.delete(id);
  const best = (m?: Map<string, number>) => m && [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const common = (m?: Map<string, number>) => m?.size && new Set(m.values()).size === 1 && (m.size > 1 || m.has('default')) ? [...m.values()][0] : undefined;
  const at = (m: Map<string, number> | undefined, e: string) => m?.get(e) ?? common(m);
  const ranges = (values: (number | undefined)[]) => { const v = values.filter((x): x is number => x !== undefined); return [Math.min(...v), Math.max(...v)] as const; };
  const scale = (v: number | undefined, [lo, hi]: readonly [number, number], low = false) => v === undefined ? undefined : hi === lo ? 1 : low ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo);
  const pr = { aaPerf: ranges([...models.values()].map(o => best(o.aaPerf)?.[1])), cogCorrect: ranges([...models.values()].map(o => best(o.cogCorrect)?.[1])) };
  const variants: { modelId: string; effort: string; raw: Raw }[] = [];
  for (const [modelId, o] of models) {
    const seen = new Set([...(o.aaPerf?.keys() ?? []), ...(o.cogCorrect?.keys() ?? [])]);
    const efforts = ORDER.filter(e => seen.has(e));
    const a = scale(best(o.aaPerf)?.[1], pr.aaPerf), c = scale(best(o.cogCorrect)?.[1], pr.cogCorrect);
    const workerEffort = best(c !== undefined && (a === undefined || c > a) ? o.cogCorrect : o.aaPerf)?.[0] ?? 'default';
    for (const effort of orch ? efforts.length ? efforts : ['default'] : [workerEffort]) {
      const raw: Raw = {};
      for (const s of SOURCES) {
        if (!orch && (s === 'cogCost' || s === 'cogDuration')) continue;  // p70: 오케는 OR/OCD 사용량도 쓴다
        let v = orch ? at(o[s], effort) : s === 'aaPrice' ? o[s]?.size ? Math.min(...o[s]!.values()) : undefined : best(o[s])?.[1];
        if (v !== undefined && (s === 'or' || s === 'ocd')) v = Math.log10(v);
        if (v !== undefined && s === 'cogCost') v = Math.log10(v + 0.01);
        if (s === 'aaPrice') { const I = at(o.aaPerf, effort); v = orch ? I !== undefined && I > 0 && v !== undefined ? Math.log10(I ** 2 / (v + .01)) : undefined : v === undefined ? undefined : Math.log10(v + .01); }
        if (v !== undefined) raw[s] = v;
      }
      variants.push({ modelId, effort, raw });
    }
  }
  const rg = Object.fromEntries(SOURCES.map(s => [s, ranges(variants.map(v => v.raw[s]))])) as Record<Src, readonly [number, number]>;
  const anyPrice = variants.some(v => v.raw.aaPrice !== undefined), selected = new Map<string, DimScore>();
  for (const { modelId, effort, raw } of variants) {
    const std: Raw = {}, dims = { performance: 0, usage: 0, speed: 0, price: 0 }, dimSource: Partial<Record<Dim, Src | 'missing'>> = {};
    for (const s of SOURCES) { const v = scale(raw[s], rg[s], s === 'cogDuration' || s === 'cogCost' || (!orch && s === 'aaPrice')); if (v === undefined) continue;
      std[s] = v; const d = DIM_OF[s]; if (dimSource[d] === undefined || v > dims[d]) { dims[d] = v; dimSource[d] = s; } }
    if (!orch && raw.aaPrice === undefined && anyPrice) { dims.price = PRICE_MISSING; dimSource.price = 'missing'; }
    const contrib = Object.fromEntries(DIMS.map(d => [d, 100 * weights[d] * dims[d]])) as Record<Dim, number>;
    const item = { modelId, effort, raw, std, dims, dimSource, contrib, score: DIMS.reduce((sum, d) => sum + contrib[d], 0) }, prev = selected.get(modelId);
    if (!prev || item.score > prev.score || (item.score === prev.score && ORDER.indexOf(effort) < ORDER.indexOf(prev.effort))) selected.set(modelId, item);
  }
  return [...selected.values()].filter(r => r.dims.performance >= floor).sort((a, b) => b.score - a.score || a.modelId.localeCompare(b.modelId));
}
