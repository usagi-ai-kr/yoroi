import type { InsightRecord } from './record.js';

const sourceUrl = 'https://openrouter.ai/rankings';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
function date(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const ms = Date.parse(v); return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v;
}
const timestamp = (v: unknown): v is string => typeof v === 'string' && date(v.slice(0, 10)) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
export class OpenRouterParseError extends Error {
  constructor(readonly code: 'invalid-row' | 'invalid-response') { super(`OpenRouter ${code}`); }
}
export type OpenRouterRowResult = { readonly ok: true; readonly index: number;
  readonly records: readonly InsightRecord[]; readonly warnings: readonly string[] } |
  { readonly ok: false; readonly index: number; readonly reason: string; readonly warnings: readonly string[] };
function unknownFields(row: Record<string, unknown>, allowed: readonly string[], path: string): string[] {
  const count = Object.keys(row).filter(key => !allowed.includes(key)).length;
  return count ? [`Ignored ${count} unknown fields at ${path}`] : [];
}
/** Parses the unfiltered daily v1 dataset; filtered/week/month requests need separate context. */
export function parseOpenRouterResponse(payload: unknown, observedAt: string): readonly OpenRouterRowResult[] {
  if (!object(payload) || !Array.isArray(payload.data) || !object(payload.meta) || !timestamp(observedAt))
    throw new OpenRouterParseError('invalid-response');
  const meta = payload.meta;
  if (!timestamp(meta.as_of) || !date(meta.start_date) || !date(meta.end_date) ||
    meta.start_date > meta.end_date || meta.version !== 'v1') throw new OpenRouterParseError('invalid-response');
  const common = [...unknownFields(payload, ['data', 'meta'], 'response'),
    ...unknownFields(meta, ['as_of', 'start_date', 'end_date', 'version'], 'meta')];
  const seen = new Map<string, number>();
  return payload.data.map((row: unknown, index): OpenRouterRowResult => {
    const warnings = [...common];
    try {
      if (!object(row)) throw new OpenRouterParseError('invalid-row');
      warnings.push(...unknownFields(row, ['date', 'model_permaslug', 'total_tokens'], 'row'));
      if (!date(row.date) || row.date < meta.start_date! || row.date > meta.end_date! || !text(row.model_permaslug))
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
