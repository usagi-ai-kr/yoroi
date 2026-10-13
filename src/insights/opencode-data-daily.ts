import type { InsightRecord } from './record.js';
import { isIsoDate, isObject, type ParseRowResult } from './parse-utils.js';

/** dailyTokens 한 날짜·모델을 저장 레코드로 만든다. 저장 경로는 전 날짜를 보존한다(최신 날짜 컷 없음). */
export function openCodeDailyTokensRecord(modelId: string, value: number, date: string,
  updatedAt: string | null, observedAt: string): InsightRecord {
  return { source: 'opencode-data', modelId, metric: 'opencode_data_tokens', value, unit: 'tokens', category: 'usage',
    observedAt, sourceAsOf: updatedAt ?? date, sourceUrl: 'https://opencode.ai/data/index.json',
    sourceName: 'OpenCode Data (내부 참조 · 약관상 자동 추출 제한)', license: null,
    attributionText: updatedAt ? `Source: OpenCode Data (내부 참조), as of ${updatedAt}.` : 'Source: OpenCode Data (내부 참조).',
    method: 'page-json-polite', schemaVersion: 'opencode-data-v1', metadata: { date, ...(updatedAt && { updatedAt }) } };
}
/** 모든 dailyTokens 날짜·모델을 정규화한다. 비수치 항목은 날짜별 거절 행으로 집계해 부분 수집으로 보이게 한다. */
export function openCodeDailyTokensRows(daily: readonly unknown[], updatedAt: string | null, observedAt: string): ParseRowResult[] {
  const rows: ParseRowResult[] = [];
  let rejected = 0;
  daily.forEach((element, index) => {
    const date = isObject(element) ? element.date : undefined;
    if (!isObject(element) || typeof date !== 'string' || !isIsoDate(date) || !isObject(element.models)) {
      rows.push({ ok: false, index, reason: 'invalid-row', warnings: [] }); return;
    }
    const entries = Object.entries(element.models as Record<string, unknown>);
    const usable = entries.filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0);
    const records = usable.map(([modelId, value]) => openCodeDailyTokensRecord(modelId, value, date, updatedAt, observedAt));
    rows.push(records.length ? { ok: true, index, records, warnings: [] } : { ok: false, index, reason: 'no-models', warnings: [] });
    if (usable.length < entries.length) rows.push({ ok: false, index: daily.length + rejected++,
      reason: 'non-numeric-model-entries', warnings: [`non-numeric model entries: ${entries.length - usable.length}`] });
  });
  return rows;
}
