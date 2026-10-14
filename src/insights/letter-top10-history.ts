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
  prevOpencodeData: readonly Top10RecordInput[] = []): PreviousRankBuild {
  const prevRecords = historicalSuccessors(aaPrevious?.records ?? []);
  const prevPrices = buildPriceMap(prevRecords);
  const aaInputs: Top10RecordInput[] = prevRecords.map(v => ({ modelId: v.record.modelId, value: v.record.value,
    ...(v.record.modelAlias !== undefined && { modelAlias: v.record.modelAlias }),
    metric: v.record.metric, ...(typeof v.record.metadata?.successorOf === 'string' && { successorOf: v.record.metadata.successorOf }),
    ...(typeof v.record.metadata?.releaseDate === 'string' && { releaseDate: v.record.metadata.releaseDate }), // 오늘과 같은 릴리스 판정
    ...(prevPrices.get(v.record.modelId)?.input !== undefined && { priceInput: prevPrices.get(v.record.modelId)!.input! }),
    ...(prevPrices.get(v.record.modelId)?.output !== undefined && { priceOutput: prevPrices.get(v.record.modelId)!.output! }) }));
  let orInputs: Top10RecordInput[] = [];
  if (currentHasOr) {
    const prevOr = orSchema && getDailyWithLegacyFallback(history, { source: 'openrouter',
      publicationDate: shiftInsightDate(publicationDate, -1), requestScope: orScope, schemaVersion: orSchema });
    if (!prevOr) return { ranks: [], warnings: ['전일 OpenRouter 자료 없음: 추정 비교 대신 전일 비교를 보류합니다.'] };
    const latest = prevOr.records.map(v => v.comparisonDate).filter((d): d is string => d !== null).sort().at(-1) ?? null;
    orInputs = prevOr.records.filter(v => v.record.metric === 'total_tokens' && v.comparisonDate === latest &&
      v.record.metadata?.aggregate !== true && v.record.modelId.trim().toLowerCase() !== 'other')
      .map(v => ({ modelId: v.record.modelId, value: v.record.value, metric: 'total_tokens' }));
    orInputs = [...toRankedRecords(orInputs)];
  }
  // previousRanks reuses computeRoleTop10 → buildCandidatePool → role score, matching today's candidates.
  // 오늘 후보 풀과 같도록 전일 OpenCode Data 근거 행도 넣는다(unmeasured-evidence).
  const pr = previousRanks(aaInputs, { ...(orInputs.length && { openrouterRecords: orInputs }),
    ...(prevOpencodeData.length && { opencodeDataRecords: prevOpencodeData }) });
  const ranks = (['orchestrator', 'worker'] as const)
    .flatMap(role => [...pr[role]].map(([modelId, rank]) => ({ modelId, rank, metric: role })));
  return { ranks, warnings: [] };
}
