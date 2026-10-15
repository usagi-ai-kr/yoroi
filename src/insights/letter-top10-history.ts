import { shiftInsightDate, type InsightHistoryPort, type InsightSuccess } from './history-port.js';
import { buildPriceMap } from './letter-top10-price.js';
import { withSuccessors } from './letter-top10-candidates.js';
import { MODEL_SUCCESSORS } from './model-successors.js';
import { previousRanks } from './letter-top10-unified.js';
import { normalizeModelName, toRankedRecords, type Top10RecordInput } from './letter-top10-rank.js';
import { getDailyWithLegacyFallback } from './legacy-scopes.js';
import type { ValidatedInsightRecord } from './validation.js';
export interface PreviousRankBuild { readonly ranks: readonly { modelId: string; rank: number; metric: string }[];
  readonly warnings: readonly string[] }
export interface CurrentTop10Coverage { readonly aaOrchestrator: boolean; readonly aaWorker: boolean;
  readonly cognition: boolean; readonly openrouter: boolean; readonly opencodeData: boolean }
const AA_TOP10_METRICS = new Set(['artificial_analysis_intelligence_index', 'artificial_analysis_coding_index',
  'median_output_tokens_per_second', 'intelligence_index_cost_per_task', 'intelligence_index_total_cost']);
const AA_PRICE_METRICS = new Set(['price_1m_input_tokens', 'price_1m_output_tokens']);
/** Keep one paired-price fallback row only when a model has no ordinary AA Top10 row. */
export function buildAaTop10Inputs(records: readonly ValidatedInsightRecord[]): Top10RecordInput[] {
  const prices = buildPriceMap(records), selected = records.filter(v => AA_TOP10_METRICS.has(v.record.metric));
  const present = new Set(selected.map(v => v.record.modelId));
  const rows = selected.map(v => ({ modelId: v.record.modelId, ...(v.record.modelAlias && { modelAlias: v.record.modelAlias }),
    value: v.record.value, metric: v.record.metric, ...(prices.get(v.record.modelId)?.input !== undefined && { priceInput: prices.get(v.record.modelId)!.input }),
    ...(prices.get(v.record.modelId)?.output !== undefined && { priceOutput: prices.get(v.record.modelId)!.output }),
    ...(typeof v.record.metadata?.successorOf === 'string' && { successorOf: v.record.metadata.successorOf }),
    ...(typeof v.record.metadata?.releaseDate === 'string' && { releaseDate: v.record.metadata.releaseDate }) }));
  const fallback = records.filter(v => AA_PRICE_METRICS.has(v.record.metric) && !present.has(v.record.modelId) &&
    prices.get(v.record.modelId)?.input !== undefined && prices.get(v.record.modelId)?.output !== undefined)
    .sort((a, b) => Number(b.record.metric === 'price_1m_input_tokens') - Number(a.record.metric === 'price_1m_input_tokens'));
  return [...rows, ...fallback.filter((v, i, all) => all.findIndex(row => row.record.modelId === v.record.modelId) === i).map(v => ({
    modelId: v.record.modelId, ...(v.record.modelAlias && { modelAlias: v.record.modelAlias }), value: v.record.value,
    metric: v.record.metric, priceInput: prices.get(v.record.modelId)!.input!, priceOutput: prices.get(v.record.modelId)!.output!,
  }))];
}
export function previousTop10SourceRows(history: InsightHistoryPort, source: ValidatedInsightRecord['record']['source'],
  publicationDate: string, requestScope: string, schemaVersion: string): readonly ValidatedInsightRecord[] {
  const k = { source, publicationDate: shiftInsightDate(publicationDate, -1), requestScope, schemaVersion };
  const h = history as { getDaily(key: typeof k, o?: { readonly includePartial?: boolean }): InsightSuccess | undefined };
  try { return (h.getDaily(k, { includePartial: true }) ?? getDailyWithLegacyFallback(history, k))?.records ?? []; }
  catch { return []; }
}
export function previousOpenCodeDataTop10Records(history: InsightHistoryPort, publicationDate: string,
  requestScope: string, schemaVersion: string): Top10RecordInput[] {
  const rows = previousTop10SourceRows(history, 'opencode-data', publicationDate, requestScope, schemaVersion);
  const latest = rows.map(v => v.comparisonDate).filter((date): date is string => date !== null).sort().at(-1);
  return rows.filter(v => v.record.metric === 'opencode_data_tokens' && v.comparisonDate === latest &&
    v.record.metadata?.aggregate !== true && v.record.modelId.toLowerCase() !== 'other')
    .map(v => ({ modelId: v.record.modelId, value: v.record.value, metric: 'opencode_data_tokens' }));
}
const INDEX_METRICS = new Set(['artificial_analysis_intelligence_index', 'artificial_analysis_coding_index', 'median_output_tokens_per_second']);
function historicalSuccessors(records: readonly ValidatedInsightRecord[]): ValidatedInsightRecord[] {
  const expanded = withSuccessors(records), key = (id: string, metric: string) => `${normalizeModelName(id)}|${metric}`;
  const keys = new Set(expanded.map(v => key(v.record.modelId, v.record.metric)));
  const copied = MODEL_SUCCESSORS.flatMap(rule => expanded.filter(v => normalizeModelName(v.record.modelId) === normalizeModelName(rule.predecessor) &&
    INDEX_METRICS.has(v.record.metric) && !keys.has(key(rule.successor, v.record.metric))).map(v => ({ ...v, record: {
      ...v.record, modelId: rule.successor, metadata: { ...(v.record.metadata ?? {}), successorOf: rule.predecessor,
        indexBasis: 'predecessor-floor' } } })));
  return [...expanded, ...copied].map(v => {
    const rule = MODEL_SUCCESSORS.find(item => normalizeModelName(item.successor) === normalizeModelName(v.record.modelId));
    return rule ? { ...v, record: { ...v.record, metadata: { ...(v.record.metadata ?? {}), successorOf: rule.predecessor } } } : v;
  });
}
/** 전일 비교용 랭크. 현재 OR 참고를 쓰면 전일 OR 자료가 반드시 있어야 하며, 없으면 비교를 보류하고 사유를 남긴다. */
export function buildPreviousRanks(history: InsightHistoryPort, publicationDate: string, aaPrevious: InsightSuccess | undefined,
  orScope: string, orSchema: string | undefined, currentHasOr: boolean,
  prevOpencodeData: readonly Top10RecordInput[] = [], prevCognition: readonly Top10RecordInput[] = [],
  current: CurrentTop10Coverage = { aaOrchestrator: false, aaWorker: false, cognition: false,
    openrouter: currentHasOr, opencodeData: prevOpencodeData.length > 0 }): PreviousRankBuild {
  const prevRecords = historicalSuccessors(aaPrevious?.records ?? []);
  const aaInputs = buildAaTop10Inputs(prevRecords);
  let orInputs: Top10RecordInput[] = [];
  if (currentHasOr) {
    const prevOr = orSchema ? getDailyWithLegacyFallback(history, { source: 'openrouter',
      publicationDate: shiftInsightDate(publicationDate, -1), requestScope: orScope, schemaVersion: orSchema }) : undefined;
    const latest = prevOr?.records.map(v => v.comparisonDate).filter((d): d is string => d !== null).sort().at(-1) ?? null;
    orInputs = (prevOr?.records ?? []).filter(v => v.record.metric === 'total_tokens' && v.comparisonDate === latest &&
      v.record.metadata?.aggregate !== true && v.record.modelId.trim().toLowerCase() !== 'other')
      .map(v => ({ modelId: v.record.modelId, value: v.record.value, metric: 'total_tokens' }));
    orInputs = [...toRankedRecords(orInputs)];
  }
  // previousRanks reuses computeRoleTop10 → buildCandidatePool → role score, matching today's candidates.
  // 오늘 후보 풀과 같도록 전일 OpenCode Data 근거 행도 넣는다(unmeasured-evidence).
  const pr = previousRanks(aaInputs, { ...(orInputs.length && { openrouterRecords: orInputs }),
    ...(prevOpencodeData.length && { opencodeDataRecords: prevOpencodeData }), ...(prevCognition.length && { cognitionRecords: prevCognition }) });
  const ranks = (['orchestrator', 'worker'] as const)
    .flatMap(role => [...pr[role]].map(([modelId, rank]) => ({ modelId, rank, metric: role })));
  const previousCoverage = { aaOrchestrator: aaInputs.some(r => r.metric === 'artificial_analysis_intelligence_index'),
    aaWorker: aaInputs.some(r => r.metric === 'artificial_analysis_coding_index'), cognition: prevCognition.length > 0,
    openrouter: orInputs.length > 0, opencodeData: prevOpencodeData.length > 0 };
  const missing = (role: 'orchestrator' | 'worker') => [
    ...(role === 'orchestrator' ? current.aaOrchestrator && !previousCoverage.aaOrchestrator : current.aaWorker && !previousCoverage.aaWorker) ? ['AA'] : [],
    ...(current.cognition && !previousCoverage.cognition ? ['Cognition'] : []),
    ...(current.openrouter && !previousCoverage.openrouter ? ['OpenRouter'] : []),
    ...(current.opencodeData && !previousCoverage.opencodeData ? ['OpenCode Data'] : []),
  ];
  const held = new Set((['orchestrator', 'worker'] as const).filter(role => missing(role).length));
  const warnings = [...new Set((['orchestrator', 'worker'] as const).flatMap(role => missing(role)))];
  return { ranks: ranks.filter(row => !held.has(row.metric as 'orchestrator' | 'worker')),
    warnings: warnings.map(source => `전일 ${source} 자료 없음/스키마 불일치: 관련 역할의 전일 비교를 보류합니다.`) };
}
