import { splitBaseAndEffort, calcBlendedCost, calcCostEfficiency, type ModelVariant } from './letter-top10-group.js';
import { filterCandidates } from './letter-top10-filter.js';
import type { OffPeakRate } from './model-price-overrides.js';

export interface Top10RecordInput { readonly modelId: string; readonly value?: number; readonly metric?: string; readonly rank?: number; readonly priceInput?: number;
  readonly priceOutput?: number; readonly successorOf?: string }
export interface Top10Options { readonly arenaRecords?: readonly Top10RecordInput[]; readonly openrouterRecords?: readonly Top10RecordInput[]; readonly previousCohort?: readonly Top10RecordInput[] | null;
  readonly priceOverrides?: Readonly<Record<string, OffPeakRate>>; readonly nowUtc?: string }
const SPEED_METRIC = 'median_output_tokens_per_second';
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
export function toRefMap(records?: readonly Top10RecordInput[] | null, metric?: string): Map<string, number> {
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
/** 공식 순위(정수)가 없는 OpenRouter 사용량 레코드에는 사용량 내림차순 정수 순위(1..N)를 부여해
 *  참고 순위 자리에 토큰 값(예: OpenRouter 264308530787위)이 찍히지 않게 한다. */
export function toRankedRecords(records: readonly Top10RecordInput[]): readonly Top10RecordInput[] {
  if (!records.length || records.every(r => Number.isSafeInteger(r.rank) && (r.rank ?? 0) > 0)) return records;
  const ranks = new Map(assignCompetitionRanks(records).map(({ item, rank }) => [item, rank]));
  return records.map(r => ({ ...r, rank: Number.isSafeInteger(r.rank) && (r.rank ?? 0) > 0 ? r.rank! : ranks.get(r) ?? 1 }));
}
/** 지표 행을 variants로 만들고 제외 계열(Fable·Astra·Grok)·최신 버전만·off-peak 단가 규칙을 적용한다. */
export function buildVariants(records: readonly Top10RecordInput[], metric: string, opts?: Top10Options): ModelVariant[] {
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
