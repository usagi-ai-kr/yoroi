export interface Top10RankEntry {
  readonly rank: number;
  readonly modelId: string;
  readonly indexValue: string; // 소수점 1자리 (예: "85.4")
  readonly arenaRankText: string; // "Arena N위" 또는 "Arena -"
  readonly openrouterRankText: string; // "OpenRouter N위" 또는 "OpenRouter -"
  readonly change: '유지' | `▲${number}` | `▼${number}` | '진입' | '신규';
}
export interface Top10ExitEntry { readonly modelId: string; readonly previousRank: number; readonly text: string; }
export interface Top10Result { readonly entries: readonly Top10RankEntry[]; readonly exits: readonly Top10ExitEntry[]; }
export interface Top10RecordInput { readonly modelId: string; readonly value?: number; readonly metric?: string; readonly rank?: number; }
export interface Top10Options { readonly arenaRecords?: readonly Top10RecordInput[];
  readonly openrouterRecords?: readonly Top10RecordInput[]; readonly previousCohort?: readonly Top10RecordInput[] | null }

export function normalizeModelName(id: string): string {
  const base = (id.split('/').pop() ?? '').toLowerCase().trim();
  return base.replace(/-(?:\d{4}-\d{2}-\d{2}|\d{8}|\d{4})$/, '').replace(/\./g, '-');
}

export function assignCompetitionRanks<T extends { value?: number; modelId: string }>(items: readonly T[]): { item: T; rank: number }[] {
  const sorted = [...items].sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.modelId.localeCompare(b.modelId));
  let rank = 1;
  return sorted.map((item, idx) => {
    if (idx > 0 && (item.value ?? 0) < (sorted[idx - 1]!.value ?? 0)) rank = idx + 1;
    return { item, rank };
  });
}

function toRefMap(records?: readonly Top10RecordInput[] | null, metric?: string): Map<string, number> {
  const map = new Map<string, number>(), owner = new Map<string, string>(), ambiguous = new Set<string>();
  const put = (rawId: string, rank: number) => {
    const norm = normalizeModelName(rawId);
    const previous = owner.get(norm);
    if (previous !== undefined && previous !== rawId) { ambiguous.add(norm); return; }
    owner.set(norm, rawId);
    if (!map.has(norm)) map.set(norm, rank);
  };
  if (!records?.length) return map;
  /** Official rank rows (metric:rank) keep the source's own rank and are not re-sorted; value rows and
   * named-metric rank rows keep the per-metric separation. */
  const scoped = records.filter(r => !metric || !r.metric || r.metric === metric || r.metric === 'rank');
  const ranked = scoped.filter(r => Number.isSafeInteger(r.rank) && (r.rank ?? 0) > 0);
  if (ranked.length) for (const r of ranked) put(r.modelId, r.rank!);
  else for (const { item, rank } of assignCompetitionRanks(scoped.filter(r => Number.isFinite(r.value))))
    put(item.modelId, rank);
  for (const norm of ambiguous) map.delete(norm);
  return map;
}

function buildTop10(
  ranked: { item: Top10RecordInput; rank: number }[],
  arenaMap: Map<string, number>, orMap: Map<string, number>, prevMap: Map<string, number> | null
): Top10Result {
  const top10 = ranked.slice(0, 10);
  const curIds = new Set(top10.map(t => t.item.modelId)), curNorm = new Set(top10.map(t => normalizeModelName(t.item.modelId)));
  const entries: Top10RankEntry[] = top10.map(({ item, rank }) => {
    const norm = normalizeModelName(item.modelId);
    const pRank = prevMap ? (prevMap.get(item.modelId) ?? prevMap.get(norm)) : undefined;
    const change = !prevMap ? '신규' : pRank === undefined || pRank > 10 ? '진입' :
      rank === pRank ? '유지' : rank < pRank ? `▲${pRank - rank}` as const : `▼${rank - pRank}` as const;
    const aRank = arenaMap.get(norm);
    const oRank = orMap.get(norm);
    return {
      rank, modelId: item.modelId, indexValue: (item.value ?? 0).toFixed(1),
      arenaRankText: aRank !== undefined ? `Arena ${aRank}위` : 'Arena -',
      openrouterRankText: oRank !== undefined ? `OpenRouter ${oRank}위` : 'OpenRouter -', change,
    };
  });
  const exits: Top10ExitEntry[] = [];
  if (prevMap) {
    for (const [mId, pRank] of prevMap) {
      if (pRank <= 10 && !curIds.has(mId) && !curNorm.has(normalizeModelName(mId))) {
        exits.push({ modelId: mId, previousRank: pRank, text: `이탈: ${mId}(전일 ${pRank}위)` });
      }
    }
    exits.sort((a, b) => a.previousRank - b.previousRank);
  }
  return { entries, exits };
}

function computeTop10ByMetric(records: readonly Top10RecordInput[], metric: string, opts?: Top10Options): Top10Result {
  const ranked = assignCompetitionRanks(records.filter(r => !r.metric || r.metric === metric));
  const arenaMap = toRefMap(opts?.arenaRecords, 'rating');
  const orMap = toRefMap(opts?.openrouterRecords, 'total_tokens');
  const prevRaw = opts?.previousCohort ? toRefMap(opts.previousCohort, metric) : null;
  /** An empty previous map after metric separation means "no cohort data": report 신규, never guess 진입. */
  const prevMap = prevRaw && prevRaw.size > 0 ? prevRaw : null;
  return buildTop10(ranked, arenaMap, orMap, prevMap);
}

export function computeOrchestratorTop10(records: readonly Top10RecordInput[], opts?: Top10Options): Top10Result {
  return computeTop10ByMetric(records, 'artificial_analysis_intelligence_index', opts);
}

export function computeWorkerTop10(records: readonly Top10RecordInput[], opts?: Top10Options): Top10Result {
  return computeTop10ByMetric(records, 'artificial_analysis_coding_index', opts);
}
