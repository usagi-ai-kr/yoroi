import type { InsightRecord, InsightSource } from './record.js';
import { isIsoDate, isIsoTimestamp, isObject, isText, type ParseRowResult } from './parse-utils.js';
import { isInsightSource, isNormalizedBenchmarkRecord } from './types.js';
import { countAaRejects, sanitizeAaReject } from './aa-reject-reasons.js';

export interface ValidatedInsightRecord {
  readonly record: InsightRecord;
  /** Original data date, never observedAt or KST publication day. */
  readonly comparisonDate: string | null;
  readonly comparisonUnavailable?: 'n/a: 기준일 미상';
}
export type RecordValidation = { readonly ok: true; readonly value: ValidatedInsightRecord } |
  { readonly ok: false; readonly reason: 'unknown-source' | 'invalid-record' | 'invalid-date' };
export type InsightValidation =
  { readonly ok: true; readonly source: InsightSource; readonly records: readonly ValidatedInsightRecord[];
    readonly rejectedRows: number; readonly rejectedReasons?: Readonly<Record<string, number>>;
    readonly rejectedFields?: Readonly<Record<string, number>> } |
  { readonly ok: false; readonly reason: 'unknown-source' | 'empty-result' | 'all-rows-failed' |
    'no-valid-measurements'; readonly rejectedRows: number };

function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => jsonValue(item, depth + 1));
  return isObject(value) && Object.values(value).every(item => jsonValue(item, depth + 1));
}
function sourceUrl(value: unknown): boolean {
  if (!isText(value)) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
/** Validate parsed measurements before persistence; diagnostics never include record contents. */
export function validateInsightRecord(value: unknown): RecordValidation {
  if (!isObject(value)) return { ok: false, reason: 'invalid-record' };
  if (!isInsightSource(value.source)) return { ok: false, reason: 'unknown-source' };
  if (!isNormalizedBenchmarkRecord(value) ||
    !['category', 'sourceName', 'attributionText', 'method', 'schemaVersion'].every(key => isText(value[key])) ||
    !sourceUrl(value.sourceUrl) || !(value.license === null || isText(value.license)) ||
    (value.modelAlias !== undefined && !isText(value.modelAlias)) ||
    (value.metadata !== undefined && (!isObject(value.metadata) || !jsonValue(value.metadata)))) {
    return { ok: false, reason: 'invalid-record' };
  }
  if (!isIsoTimestamp(value.observedAt) || !value.observedAt.endsWith('Z') ||
    !(isIsoDate(value.sourceAsOf) || isIsoTimestamp(value.sourceAsOf))) {
    return { ok: false, reason: 'invalid-date' };
  }
  const record = value as unknown as InsightRecord;
  // The current AA/Cognition publishers have no confirmed update date (contract 3-A).
  if (record.source === 'artificial-analysis' || record.source === 'cognition') {
    return { ok: true, value: { record, comparisonDate: null, comparisonUnavailable: 'n/a: 기준일 미상' } };
  }
  if (record.metadata?.sourceAsOfBasis === 'observedAt-fallback') return { ok: false, reason: 'invalid-date' };
  const date = record.metadata?.date;
  if (!isIsoDate(date)) return { ok: false, reason: 'invalid-date' };
  return { ok: true, value: { record, comparisonDate: date } };
}
/** Source success requires at least one valid measurement. Reject a malformed row atomically,
 * preserve other valid rows, and never promote another source's records into this source's cache. */
export function validateInsightRows(source: unknown, rows: readonly ParseRowResult[]): InsightValidation {
  if (!isInsightSource(source)) return { ok: false, reason: 'unknown-source', rejectedRows: rows.length };
  if (!rows.length) return { ok: false, reason: 'empty-result', rejectedRows: 0 };
  if (rows.every(row => !row.ok)) return { ok: false, reason: 'all-rows-failed', rejectedRows: rows.length };
  const records: ValidatedInsightRecord[] = [];
  let rejectedRows = 0;
  const rejects: Array<{ readonly code: string; readonly fields: ReadonlyArray<string> }> = [];
  const wantDiagnostics = source === 'artificial-analysis';
  for (const row of rows) {
    if (!row.ok) {
      rejectedRows++;
      if (!wantDiagnostics) continue;
      const extra = row as { readonly rejectCode?: unknown; readonly rejectFields?: unknown };
      rejects.push(sanitizeAaReject({ code: extra.rejectCode, fields: extra.rejectFields }));
      continue;
    }
    const validated = row.records.map(validateInsightRecord);
    const failed = validated.find(result => !result.ok || result.value.record.source !== source);
    if (failed) {
      rejectedRows++;
      if (wantDiagnostics) rejects.push(sanitizeAaReject({
        code: `validation:${failed.ok ? 'source-mismatch' : failed.reason}`, fields: [] }));
      continue;
    }
    for (const result of validated) if (result.ok) records.push(result.value);
  }
  const counts = countAaRejects(rejects);
  return records.length ? { ok: true, source, records, rejectedRows,
    ...(rejectedRows > 0 && wantDiagnostics ? { rejectedReasons: counts.codes, rejectedFields: counts.fields } : {}) }
    : { ok: false, reason: 'no-valid-measurements', rejectedRows };
}
