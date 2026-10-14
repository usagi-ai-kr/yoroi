import { normalizeModelName } from './model-id.js';
import { getDailyWithLegacyFallback } from './legacy-scopes.js';
import { shiftInsightDate, type InsightHistoryPort } from './history-port.js';
import type { InsightSuccess } from './history-port.js';
import type { Top10RecordInput } from './letter-top10-rank.js';
import type { ValidatedInsightRecord } from './validation.js';

const EFFORTS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const METRICS: Readonly<Record<string, string>> = { correct: 'cognition_correct', cost: 'cognition_cost',
  duration_min: 'cognition_duration_min' };

/** p48: 현재 Cognition 성공 행에서 main correct만 워커 점수 입력으로 변환한다. */
export function buildCognitionTop10Records(records: readonly ValidatedInsightRecord[]): Top10RecordInput[] {
  return records.flatMap(({ record }) => {
    const metric = METRICS[record.metric];
    if (record.source !== 'cognition' || !metric || record.metadata?.subset !== 'main' || !Number.isFinite(record.value) ||
      record.value < 0 || record.metric === 'correct' && record.value > 1 ||
      record.metric === 'duration_min' && record.value <= 0) return [];
    const name = normalizeModelName(record.modelId.replace(/\s+/g, '-'));
    const effort = record.metadata?.effort;
    const modelId = typeof effort === 'string' && EFFORTS.has(effort) ? `${name}-${effort}` : name;
    return [{ modelId, metric, value: record.value }];
  });
}

/** 전일 publication snapshot의 main correct만 동일한 입력 계약으로 바꾼다. */
export function buildPreviousCognitionTop10Records(history: InsightHistoryPort, publicationDate: string,
  requestScope: string, schemaVersion: string): Top10RecordInput[] {
  let previous: InsightSuccess | undefined;
  try { previous = getDailyWithLegacyFallback(history, { source: 'cognition',
    publicationDate: shiftInsightDate(publicationDate, -1), requestScope, schemaVersion }); } catch { previous = undefined; }
  return buildCognitionTop10Records(previous?.records ?? []);
}
