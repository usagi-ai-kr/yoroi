import type { InsightRecord } from './record.js';
import { isObject, isText, isIsoDate, isIsoTimestamp, unknownFields,
  type ParseRowResult } from './parse-utils.js';

const sourceUrl = 'https://openrouter.ai/rankings';
export class OpenRouterParseError extends Error {
  constructor(readonly code: 'invalid-row' | 'invalid-response') { super(`OpenRouter ${code}`); }
}
export type OpenRouterRowResult = ParseRowResult;
/** Parses the unfiltered daily v1 dataset; filtered/week/month requests need separate context. */
export function parseOpenRouterResponse(payload: unknown, observedAt: string): readonly OpenRouterRowResult[] {
  if (!isObject(payload) || !Array.isArray(payload.data) || !isObject(payload.meta) || !isIsoTimestamp(observedAt))
    throw new OpenRouterParseError('invalid-response');
  const meta = payload.meta;
  if (!isIsoTimestamp(meta.as_of) || !isIsoDate(meta.start_date) || !isIsoDate(meta.end_date) ||
    meta.start_date > meta.end_date || meta.version !== 'v1') throw new OpenRouterParseError('invalid-response');
  const common = [...unknownFields(payload, ['data', 'meta'], 'response'),
    ...unknownFields(meta, ['as_of', 'start_date', 'end_date', 'version'], 'meta')];
  const seen = new Map<string, number>();
  return payload.data.map((row: unknown, index): OpenRouterRowResult => {
    const warnings = [...common];
    try {
      if (!isObject(row)) throw new OpenRouterParseError('invalid-row');
      warnings.push(...unknownFields(row, ['date', 'model_permaslug', 'total_tokens'], 'row'));
      if (!isIsoDate(row.date) || row.date < meta.start_date! || row.date > meta.end_date! || !isText(row.model_permaslug))
        throw new OpenRouterParseError('invalid-row');
      // Wire examples encode integer totals as strings; reject precision loss and coercions.
      if (!(typeof row.total_tokens === 'string' && /^\d+$/.test(row.total_tokens)) &&
        typeof row.total_tokens !== 'number') throw new OpenRouterParseError('invalid-row');
      const value = Number(row.total_tokens);
      if (!Number.isSafeInteger(value) || value < 0) throw new OpenRouterParseError('invalid-row');
      const identity = JSON.stringify([row.date, row.model_permaslug]);
      if (seen.has(identity)) {
        warnings.push(seen.get(identity) === value ? 'Duplicate row skipped; first row retained' :
          'Duplicate row skipped: conflicting total_tokens; first row retained');
        return { ok: true, index, records: [], warnings };
      }
      const record: InsightRecord = { source: 'openrouter', modelId: row.model_permaslug,
        metric: 'total_tokens', value, unit: 'tokens', category: 'usage', observedAt,
        sourceAsOf: meta.as_of as string, sourceUrl, sourceName: 'OpenRouter', license: 'CC-BY-4.0',
        attributionText: `Source: OpenRouter (openrouter.ai/rankings), as of ${meta.as_of}.`,
        method: 'official-api', schemaVersion: 'openrouter-rankings-v1', metadata: {
          date: row.date, startDate: meta.start_date as string, endDate: meta.end_date as string,
          version: 'v1', period: 'day', aggregate: row.model_permaslug === 'other' } };
      seen.set(identity, value);
      return { ok: true, index, records: [record], warnings };
    } catch { return { ok: false, index, reason: 'OpenRouter invalid-row', warnings }; }
  });
}
