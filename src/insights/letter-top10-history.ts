import { shiftInsightDate, type InsightHistoryPort, type InsightSuccess } from './history-port.js';
import { buildPriceMap } from './letter-top10-price.js';
import { computePreviousRanks, type Top10RecordInput } from './letter-top10-rank.js';

export interface PreviousRankBuild { readonly ranks: readonly { modelId: string; rank: number; metric: string }[];
  readonly warnings: readonly string[] }
/** 전일 비교용 랭크. 현재 OR 참고를 쓰면 전일 OR 자료가 반드시 있어야 하며, 없으면 비교를 보류하고 사유를 남긴다. */
export function buildPreviousRanks(history: InsightHistoryPort, publicationDate: string, aaPrevious: InsightSuccess | undefined,
  orScope: string, orSchema: string | undefined, currentHasOr: boolean): PreviousRankBuild {
  const prevPrices = buildPriceMap(aaPrevious?.records ?? []);
  const aaInputs: Top10RecordInput[] = (aaPrevious?.records ?? []).map(v => ({ modelId: v.record.modelId, value: v.record.value,
    metric: v.record.metric, ...(prevPrices.get(v.record.modelId)?.input !== undefined && { priceInput: prevPrices.get(v.record.modelId)!.input! }),
    ...(prevPrices.get(v.record.modelId)?.output !== undefined && { priceOutput: prevPrices.get(v.record.modelId)!.output! }) }));
  let orInputs: Top10RecordInput[] = [];
  if (currentHasOr) {
    const prevOr = orSchema && history.getDaily({ source: 'openrouter', publicationDate: shiftInsightDate(publicationDate, -1),
      requestScope: orScope, schemaVersion: orSchema });
    if (!prevOr) return { ranks: [], warnings: ['전일 OpenRouter 자료 없음: 추정 비교 대신 전일 비교를 보류합니다.'] };
    const latest = prevOr.records.map(v => v.comparisonDate).filter((d): d is string => d !== null).sort().at(-1) ?? null;
    orInputs = prevOr.records.filter(v => v.record.metric === 'total_tokens' && v.comparisonDate === latest &&
      v.record.metadata?.aggregate !== true && v.record.modelId.trim().toLowerCase() !== 'other')
      .map(v => ({ modelId: v.record.modelId, value: v.record.value, metric: 'total_tokens' }));
  }
  const metrics: readonly [string, boolean][] = [['artificial_analysis_intelligence_index', false], ['artificial_analysis_coding_index', true]];
  const ranks = metrics.flatMap(([metric, isWorker]) => [...computePreviousRanks(aaInputs, metric, isWorker,
    orInputs.length ? { openrouterRecords: orInputs } : {})].map(([modelId, rank]) => ({ modelId, rank, metric })));
  return { ranks, warnings: [] };
}
