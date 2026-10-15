import { type InsightDailyKey, type InsightHistoryPort, type InsightHistoryDay, type InsightSeriesKey,
  type InsightSuccess, INSIGHT_HISTORY_RETENTION_DAYS, shiftInsightDate } from './history-port.js';
import { isIsoDate, isText } from './parse-utils.js';
import { isInsightSource } from './types.js';
import type { InsightRecord } from './record.js';
import { validateInsightRows, type InsightValidation, type ValidatedInsightRecord } from './validation.js';
import { buildRejectionDiagnostics } from './rejection-diagnostics.js';

const copy = <T>(value: T): T => structuredClone(value);
const RECORD_FIELDS = ['source', 'modelId', 'modelAlias', 'metric', 'value', 'unit', 'metadata', 'category',
  'observedAt', 'sourceAsOf', 'sourceUrl', 'sourceName', 'license', 'attributionText', 'method', 'schemaVersion'];
function dailyId(key: InsightDailyKey): string {
  if (!isInsightSource(key.source) || !isIsoDate(key.publicationDate) || !isText(key.schemaVersion) ||
    !/^[A-Za-z0-9._:@-]{1,128}$/.test(key.requestScope)) throw new RangeError('Invalid insight history key');
  return JSON.stringify([key.source, key.publicationDate, key.requestScope, key.schemaVersion]);
}
function seriesId(key: InsightSeriesKey): string {
  dailyId({ ...key, publicationDate: '2000-01-01' });
  if (![key.modelId, key.metric, key.unit, key.category].every(isText)) throw new RangeError('Invalid insight series');
  return JSON.stringify([key.source, key.requestScope, key.schemaVersion, key.modelId, key.metric, key.unit, key.category]);
}
export class MemoryInsightHistory implements InsightHistoryPort {
  private readonly daily = new Map<string, { date: string; result: InsightSuccess }>();
  private readonly history = new Map<string, { date: string; measurement: ValidatedInsightRecord }>();
  getDaily(key: InsightDailyKey): InsightSuccess | undefined {
    const stored = this.daily.get(dailyId(key));
    return stored ? copy(stored.result) : undefined;
  }
  saveDaily(key: InsightDailyKey, result: InsightValidation,
    options: { readonly refresh?: boolean; readonly complete?: boolean } = {}): boolean {
    const id = dailyId(key);
    const partial = result.rejectedRows > 0; // 행 일부 거절 partial만 SQLite처럼 daily에 허용한다
    if (!result.ok || (options.complete === false && !partial) || (this.daily.has(id) && !options.refresh)) return false;
    if (result.source !== key.source || result.records.some(value => value.record.schemaVersion !== key.schemaVersion)) return false;
    // Revalidate at the persistence boundary: callers cannot forge comparison dates or empty success.
    const checked = validateInsightRows(key.source, [{ ok: true, index: 0,
      records: result.records.map(value => value.record), warnings: [] }]);
    if (!checked.ok) return false;
    const diagnostics = buildRejectionDiagnostics(result);
    const success: InsightSuccess = copy({ ...checked, rejectedRows: result.rejectedRows,
      ...(diagnostics !== undefined && { rejectionDiagnostics: diagnostics }),
      records: checked.records.map(value => ({ ...value, record: Object.fromEntries(
        Object.entries(value.record).filter(([field]) => RECORD_FIELDS.includes(field))) as unknown as InsightRecord })) });
    this.daily.set(id, { date: key.publicationDate, result: success });
    for (const measurement of partial ? [] : success.records) {
      if (measurement.comparisonDate === null) continue;
      const { modelId, metric, unit, category } = measurement.record;
      const series = seriesId({ ...key, modelId, metric, unit, category });
      const recordId = JSON.stringify([series, measurement.comparisonDate]);
      const previous = this.history.get(recordId);
      // A delayed response must not replace a more recently observed same-date value.
      if (previous && Date.parse(previous.measurement.record.observedAt) > Date.parse(measurement.record.observedAt)) continue;
      this.history.set(recordId, { date: key.publicationDate, measurement });
    }
    return true;
  }
  previous(key: InsightSeriesKey, comparisonDate: string): ValidatedInsightRecord | undefined {
    return this.onDate(key, shiftInsightDate(comparisonDate, -1));
  }
  sevenDays(key: InsightSeriesKey, throughDate: string): readonly InsightHistoryDay[] {
    return Array.from({ length: 7 }, (_, index) => {
      const date = shiftInsightDate(throughDate, index - 6);
      const measurement = this.onDate(key, date);
      return measurement ? { date, measurement } : { date };
    });
  }
  private onDate(key: InsightSeriesKey, date: string): ValidatedInsightRecord | undefined {
    const stored = this.history.get(JSON.stringify([seriesId(key), date]));
    return stored ? copy(stored.measurement) : undefined;
  }
  prune(publicationDate: string): number {
    const cutoff = shiftInsightDate(publicationDate, 1 - INSIGHT_HISTORY_RETENTION_DAYS);
    let removed = 0;
    for (const [id, entry] of this.daily) if (entry.date < cutoff) { this.daily.delete(id); removed++; }
    for (const [id, entry] of this.history) if (entry.date < cutoff) this.history.delete(id);
    return removed;
  }
}
