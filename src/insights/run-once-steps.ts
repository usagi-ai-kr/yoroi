import { SourceError } from '../app/usage-source.js';
import { compareInsightPrevious } from './comparison.js';
import { shiftInsightDate, type InsightHistoryPort, type InsightSeriesKey, type InsightSuccess } from './history-port.js';
import type { LetterFailure, LetterMeasurement, LetterRankInput } from './letter-sections.js';
import type { InsightValidation } from './validation.js';
import type { InsightSource } from './record.js';
import { computeInsightRankChanges } from './rank-change.js';
import { computeInsightTrend } from './trend.js';

/** Default parser schema versions (daily-reuse lookup happens before any fetch). A stale entry only misses the cache. */
export const DEFAULT_SCHEMA_VERSIONS: Readonly<Record<InsightSource, string>> = Object.freeze({
  arena: 'arena-hf-v1', 'artificial-analysis': 'aa-v2-free', openrouter: 'openrouter-rankings-v1', cognition: 'cognition-frontiercode-v1' });
/** Opaque, secret-free request scope per source (subset/period/filter/tier); part of every history key. */
export const DEFAULT_REQUEST_SCOPES: Readonly<Record<InsightSource, string>> = Object.freeze({
  arena: 'hf-rows:text:latest:overall-top50', 'artificial-analysis': 'aa-v2:free:language-models:coding-intel-value-top50',
  openrouter: 'rankings-daily:day:top50', cognition: 'frontiercode:data-json:top50' });
/** Metric whose ordering defines rank changes per source; same-source cohorts only. */
export const RANK_COHORTS: Readonly<Record<InsightSource, { readonly metric: string; readonly order: 'ascending' | 'descending';
  readonly extraMetrics?: readonly string[] }>> = Object.freeze({
  arena: { metric: 'rating', order: 'descending' },
  'artificial-analysis': { metric: 'artificial_analysis_coding_index', order: 'descending',
    extraMetrics: ['artificial_analysis_intelligence_index'] },
  openrouter: { metric: 'total_tokens', order: 'descending' }, cognition: { metric: 'correct', order: 'descending' } });

/** Source/validation failure to the letter's failure kind: transport → fetch, bad rows → parse, nothing usable → empty. */
export function failureKind(error: SourceError | undefined, validation?: Extract<InsightValidation, { ok: false }>): LetterFailure {
  if (error) return error.code === 'parse' ? 'parse' : 'fetch';
  return validation?.reason === 'empty-result' || validation?.reason === 'no-valid-measurements' ? 'empty' : 'parse';
}

/** C1 (previous day) + C3 (seven days) per record, then the evidence cut: largest real changes first, the rest in
 * source order. The cut is presentation only; nothing is estimated or filled in. */
export function buildMeasurements(history: InsightHistoryPort, scope: string, success: InsightSuccess, limit: number): LetterMeasurement[] {
  const items = success.records.map((measurement): LetterMeasurement => {
    const { record, comparisonDate: date } = measurement;
    const series: InsightSeriesKey = { source: record.source, requestScope: scope, schemaVersion: record.schemaVersion,
      modelId: record.modelId, metric: record.metric, unit: record.unit, category: record.category };
    const earlier = (through: string): boolean => history.sevenDays(series, through).some(day => day.measurement !== undefined);
    if (date === null) return { measurement, comparison: compareInsightPrevious(measurement, undefined), trend: computeInsightTrend(measurement, []) };
    return { measurement, comparison: compareInsightPrevious(measurement, history.previous(series, date), { hasEarlierHistory: earlier(shiftInsightDate(date, -1)) }),
      trend: computeInsightTrend(measurement, history.sevenDays(series, date), { hasEarlierHistory: earlier(shiftInsightDate(date, -7)) }) };
  });
  const change = (item: LetterMeasurement): number => (item.comparison.comparable ? Math.abs(item.comparison.absoluteChange) : -1);
  return items.map((item, index) => ({ item, index })).sort((a, b) => change(b.item) - change(a.item) || a.index - b.index)
    .slice(0, limit).map(entry => entry.item);
}

/** C2 per category cohort of the source's rank metric against the previous publication day's stored snapshot. */
export function buildRanks(history: InsightHistoryPort, scope: string, publicationDate: string, success: InsightSuccess,
  complete: boolean, limit: number): LetterRankInput[] {
  const cohort = RANK_COHORTS[success.source];
  const first = success.records[0]?.record;
  const previous = first && history.getDaily({ source: success.source, publicationDate: shiftInsightDate(publicationDate, -1), requestScope: scope, schemaVersion: first.schemaVersion });
  /** One daily series can carry many comparison dates (OpenRouter); rank only the latest real date and never
   * bridge dates: previous uses stored records of exactly the preceding date, otherwise n/a. */
  const dated = success.records.map(value => value.comparisonDate).filter((date): date is string => date !== null);
  const cohortDate = dated.length ? dated.sort().at(-1)! : null;
  const previousDate = cohortDate === null ? null : shiftInsightDate(cohortDate, -1);
  const window = { windowSize: 50 };
  const groups: LetterRankInput[] = [];
  for (const metric of [cohort.metric, ...(cohort.extraMetrics ?? [])]) {
    const metricRecords = success.records.filter(value => value.record.metric === metric && value.comparisonDate === cohortDate);
    const categories = [...new Set(metricRecords.map(value => value.record.category))].slice(0, limit - groups.length);
    for (const category of categories) {
      const records = metricRecords.filter(value => value.record.category === category);
      const before = previous && previousDate !== null ? previous.records.filter(value => value.record.metric === metric &&
        value.record.category === category && value.comparisonDate === previousDate) : [];
      groups.push({ reference: records[0]!, previousDate: before[0]?.comparisonDate ?? null,
        result: computeInsightRankChanges({ records, complete }, before.length ? { records: before, complete: true } : undefined, cohort.order, window) });
    }
    if (groups.length >= limit) break;
  }
  return groups;
}
