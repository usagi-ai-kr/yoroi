import { splitBaseAndEffort, calcBlendedCost, calcCostEfficiency, groupVariants, type ModelVariant } from './letter-top10-group.js';
import { filterCandidates } from './letter-top10-filter.js';
import type { OffPeakRate } from './model-price-overrides.js';
import { selectOptimalZone, type ScoredGroup } from './letter-top10-worker.js';
export interface Top10RankEntry {
  readonly rank: number; readonly modelId: string; readonly repEffort: string; readonly indexValue: string;
  readonly blendedCostText: string; readonly costEffRankText: string; readonly costText: string;
  readonly openrouterRankText: string; readonly arenaRankText: string; readonly isPareto: boolean;
  readonly change: '유지' | `▲${number}` | `▼${number}` | '진입' | '신규'; readonly variantsText?: string;
}
export interface Top10ExitEntry { readonly modelId: string; readonly previousRank: number; readonly text: string }
export interface Top10Result { readonly entries: readonly Top10RankEntry[]; readonly exits: readonly Top10ExitEntry[] }
export interface Top10RecordInput { readonly modelId: string; readonly value?: number; readonly metric?: string; readonly rank?: number; readonly priceInput?: number;
  readonly priceOutput?: number }
export interface Top10Options { readonly arenaRecords?: readonly Top10RecordInput[]; readonly openrouterRecords?: readonly Top10RecordInput[]; readonly previousCohort?: readonly Top10RecordInput[] | null;
  readonly priceOverrides?: Readonly<Record<string, OffPeakRate>>; readonly nowUtc?: string } const SPEED_METRIC = 'median_output_tokens_per_second';
export function normalizeModelName(id: string): string {
  const base = (id.split('/').pop() ?? '').toLowerCase().trim();
  return base.replace(/-(?:\d{4}-\d{2}-\d{2}|\d{8}|\d{4})$/, '').replace(/\./g, '-');
}
export function assignCompetitionRanks<T extends { value?: number; modelId: string }>(items: readonly T[]): { item: T; rank: number }[] {
  const sorted = [...items].sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.modelId.localeCompare(b.modelId)); let rank = 1;
  return sorted.map((item, idx) => {
    if (idx > 0 && (item.value ?? 0) < (sorted[idx - 1]!.value ?? 0)) rank = idx + 1;
    return { item, rank };
  });
}
function toRefMap(records?: readonly Top10RecordInput[] | null, metric?: string): Map<string, number> {
  const map = new Map<string, number>(), owner = new Map<string, string>(), amb = new Set<string>();
  const put = (rawId: string, rank: number) => {
    const norm = normalizeModelName(rawId), prev = owner.get(norm);
    if (prev !== undefined && prev !== rawId) { amb.add(norm); return; }
    owner.set(norm, rawId); if (!map.has(norm)) map.set(norm, rank);
  };
  if (!records?.length) return map;
  const scoped = records.filter(r => !metric || !r.metric || r.metric === metric || r.metric === 'rank');
  const ranked = scoped.filter(r => Number.isSafeInteger(r.rank) && (r.rank ?? 0) > 0);
  if (ranked.length) for (const r of ranked) put(r.modelId, r.rank!);
  else for (const { item, rank } of assignCompetitionRanks(scoped.filter(r => Number.isFinite(r.value)))) put(item.modelId, rank);
  for (const n of amb) map.delete(n);
  return map;
}
function buildVariants(records: readonly Top10RecordInput[], metric: string, opts?: Top10Options): ModelVariant[] {
  const orMap = toRefMap(opts?.openrouterRecords, 'total_tokens'), arenaMap = toRefMap(opts?.arenaRecords, 'rating');
  const speedMap = new Map(records.filter(r => r.metric === SPEED_METRIC && Number.isFinite(r.value)).map(r => [normalizeModelName(r.modelId), r.value!]));
  return filterCandidates(records.filter(r => (!r.metric || r.metric === metric) && Number.isFinite(r.value)).map(r => {
    const { base, effort } = splitBaseAndEffort(r.modelId), cost = calcBlendedCost(r.priceInput, r.priceOutput);
    const eff = calcCostEfficiency(r.value!, cost);
    const orTokens = opts?.openrouterRecords?.find(o => normalizeModelName(o.modelId) === normalizeModelName(r.modelId) ||
      normalizeModelName(o.modelId) === normalizeModelName(base))?.value;
    const aRank = arenaMap.get(normalizeModelName(r.modelId)) ?? arenaMap.get(normalizeModelName(base));
    const speed = speedMap.get(normalizeModelName(r.modelId));
    return { modelId: r.modelId, baseModelId: base, effort, value: r.value!, ...(cost !== undefined && { blendedCost: cost }),
      ...(eff !== undefined && { costEfficiency: eff }), ...(orTokens !== undefined && { openrouterTokens: orTokens }),
      ...(aRank !== undefined && { arenaRank: aRank }), ...(speed !== undefined && { outputTokensPerSecond: speed }) };
  }), opts?.priceOverrides, opts?.nowUtc);
}
function toEntry(s: ScoredGroup, idx: number, orMap: Map<string, number>, prevMap: Map<string, number> | null): Top10RankEntry {
  const rank = idx + 1, pRank = prevMap ? prevMap.get(normalizeModelName(s.group.baseModelId)) : undefined;
  const change = !prevMap ? '신규' : pRank === undefined || pRank > 10 ? '진입' :
    rank === pRank ? '유지' : rank < pRank ? `▲${pRank - rank}` as const : `▼${rank - pRank}` as const;
  const rep = s.group.repVariant;
  const bCost = rep.blendedCost === undefined ? '단가 -' : rep.blendedCost === 0 ? '무료' : `$${rep.blendedCost.toFixed(2)}/1M`;
  const vText = s.group.variants.length > 1 ? s.group.variants.slice(0, 3).map(v => `${v.effort} ${v.value.toFixed(1)}`).join(' · ') + (s.group.variants.length > 3 ? ` 외 ${s.group.variants.length - 3}개` : '') : undefined;
  const orRank = orMap.get(normalizeModelName(rep.modelId)) ?? orMap.get(normalizeModelName(s.group.baseModelId));
  const off = rep.offPeak ? ' · off-peak' : '';
  return {
    rank, modelId: s.group.baseModelId, repEffort: rep.effort, indexValue: rep.value.toFixed(1),
    blendedCostText: bCost, costEffRankText: rep.costEfficiency === undefined ? '가성비 n/a' : `가성비 ${s.costEffRank}위`,
    costText: `지수 ${rep.value.toFixed(1)} · ${bCost}${off} · 가성비 ${rep.costEfficiency === undefined ? 'n/a' : `${s.costEffRank}위`}`,
    openrouterRankText: orRank !== undefined ? `OpenRouter ${orRank}위` : 'OpenRouter -',
    arenaRankText: rep.arenaRank !== undefined ? `Arena ${rep.arenaRank}위` : 'Arena -',
    isPareto: s.group.isPareto, change, ...(vText && { variantsText: vText }),
  };
}
function computeTop10(records: readonly Top10RecordInput[], metric: string, isWorker: boolean, opts?: Top10Options): Top10Result {
  const variants = buildVariants(records, metric, opts), candidates = [...groupVariants(variants)];
  const top10 = selectOptimalZone(candidates, isWorker ? 'worker' : 'orchestrator').slice(0, 10);
  const prevRaw = opts?.previousCohort ? toRefMap(opts.previousCohort, metric) : null;
  const prevMap = prevRaw && prevRaw.size > 0 ? prevRaw : null;
  const curBases = new Set(top10.map(s => normalizeModelName(s.group.baseModelId))), exits: Top10ExitEntry[] = [];
  if (prevMap) {
    for (const [rawId, pRank] of prevMap) if (pRank <= 10 && !curBases.has(normalizeModelName(rawId)))
      exits.push({ modelId: rawId, previousRank: pRank, text: `이탈: ${rawId}(전일 ${pRank}위)` });
    exits.sort((a, b) => a.previousRank - b.previousRank);
  }
  const orMap = toRefMap(opts?.openrouterRecords, 'total_tokens');
  return { entries: top10.map((s, idx) => toEntry(s, idx, orMap, prevMap)), exits };
}
export const computeOrchestratorTop10 = (records: readonly Top10RecordInput[], opts?: Top10Options) =>
  computeTop10(records, 'artificial_analysis_intelligence_index', false, opts);
export const computeWorkerTop10 = (records: readonly Top10RecordInput[], opts?: Top10Options) =>
  computeTop10(records, 'artificial_analysis_coding_index', true, opts);
/** 전일 비교용: 같은 최적 존 정책(임계+가성비+OR 동점)으로 전일 코호트 순위를 계산한다. */
export function computePreviousRanks(records: readonly Top10RecordInput[], metric: string, isWorker: boolean,
  opts?: { readonly openrouterRecords?: readonly Top10RecordInput[]; readonly priceOverrides?: Readonly<Record<string, OffPeakRate>> }): Map<string, number> {
  const ranked = selectOptimalZone([...groupVariants(buildVariants(records, metric, opts))], isWorker ? 'worker' : 'orchestrator');
  return new Map(ranked.slice(0, 10).map((s, idx) => [normalizeModelName(s.group.baseModelId), idx + 1]));
}
