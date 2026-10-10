import type { InsightRecord } from './record.js';

const sourceUrl = 'https://artificialanalysis.ai/data-api/docs';
const indices = ['intelligence', 'coding', 'agentic', 'finance_and_accounting',
  'strategy_and_ops', 'legal', 'healthcare_and_medical', 'engineering', 'economics']
  .map(name => `artificial_analysis_${name}_index`);
const fields = {
  evaluations: indices.map(name => [name, 'score']),
  pricing: ['input', 'output', 'cache_hit', 'cache_write'].map(name => [`price_1m_${name}_tokens`, 'USD/1M tokens']),
  performance: [['median_output_tokens_per_second', 'tokens/s'],
    ...['time_to_first_token', 'time_to_first_answer_token', 'end_to_end_response_time']
      .map(name => [`median_${name}_seconds`, 'seconds'])],
} as const;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
function date(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const ms = Date.parse(v); return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v;
}
const timestamp = (v: unknown): v is string => typeof v === 'string' && date(v.slice(0, 10)) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
export class AaParseError extends Error {
  constructor(readonly code: 'invalid-row' | 'invalid-response') { super(`Artificial Analysis ${code}`); }
}
export type AaRowResult = { readonly ok: true; readonly index: number;
  readonly records: readonly InsightRecord[]; readonly warnings: readonly string[] } |
  { readonly ok: false; readonly index: number; readonly reason: string; readonly warnings: readonly string[] };
function fail(): never { throw new AaParseError('invalid-row'); }
function unknownFields(row: Record<string, unknown>, allowed: readonly string[], path: string): string[] {
  const count = Object.keys(row).filter(key => !allowed.includes(key)).length;
  return count ? [`Ignored ${count} unknown fields at ${path}`] : [];
}
/** Free-shape V2 metrics only; Pro additions are ignored with warnings.
 * No documented source-update timestamp: sourceAsOf explicitly falls back to observedAt. */
export function parseAaResponse(payload: unknown, observedAt: string): readonly AaRowResult[] {
  if (!object(payload) || !Array.isArray(payload.data) || !timestamp(observedAt) ||
    !['free', 'pro', 'commercial'].includes(String(payload.tier)) ||
    typeof payload.intelligence_index_version !== 'number' || !Number.isFinite(payload.intelligence_index_version) ||
    !object(payload.pagination) || !['page', 'page_size', 'total_pages'].every(k =>
      Number.isSafeInteger(payload.pagination && (payload.pagination as Record<string, unknown>)[k]) &&
      Number((payload.pagination as Record<string, unknown>)[k]) >= 1) ||
    typeof payload.pagination.has_more !== 'boolean') throw new AaParseError('invalid-response');
  const version = payload.intelligence_index_version;
  const commonWarnings = [...unknownFields(payload, ['tier', 'intelligence_index_version', 'pagination', 'data'], 'response'),
    ...unknownFields(payload.pagination, ['page', 'page_size', 'total_pages', 'has_more'], 'pagination'),
    'Source update time unconfirmed; sourceAsOf uses observedAt'];
  return payload.data.map((row: unknown, index): AaRowResult => {
    const warnings = [...commonWarnings];
    try {
      if (!object(row) || !text(row.id) || !text(row.slug) || !text(row.name) ||
        !object(row.model_creator) || !text(row.model_creator.id) || !text(row.model_creator.name) ||
        !(row.release_date === null || date(row.release_date))) fail();
      warnings.push(...unknownFields(row, ['id', 'slug', 'name', 'release_date', 'model_creator',
        ...Object.keys(fields), 'artificial_analysis_intelligence_index_cost'], 'model'),
        ...unknownFields(row.model_creator, ['id', 'name'], 'model_creator'));
      const records: InsightRecord[] = [];
      const add = (metric: string, value: unknown, unit: string) => {
        if (value === null) return;
        if (typeof value !== 'number' || !Number.isFinite(value) || (unit !== 'score' && value < 0)) fail();
        records.push({ source: 'artificial-analysis', modelId: row.slug as string, modelAlias: row.name as string,
          metric, value, unit, category: 'language-models', observedAt, sourceAsOf: observedAt,
          sourceUrl, sourceName: 'Artificial Analysis', license: null,
          attributionText: 'Source: Artificial Analysis (https://artificialanalysis.ai/)',
          method: 'official-api', schemaVersion: 'aa-v2-free', metadata: {
            intelligence_index_version: version, sourceAsOfBasis: 'observedAt-fallback',
            modelCreator: (row.model_creator as Record<string, string>).name!,
            releaseDate: row.release_date as string | null } });
      };
      for (const [group, metrics] of Object.entries(fields)) {
        const values = row[group]; if (!object(values)) fail();
        warnings.push(...unknownFields(values, metrics.map(([name]) => name!), group));
        for (const [metric, unit] of metrics) if (metric! in values) add(metric!, values[metric!], unit!);
      }
      const cost = row.artificial_analysis_intelligence_index_cost;
      const optionalCost = (metric: string, value: unknown, unit: string) => {
        if (value === undefined || value === null) warnings.push(`Missing ${metric}; metric omitted`);
        else add(metric, value, unit);
      };
      if (cost === undefined || cost === null) warnings.push('Missing index_cost; cost metrics omitted');
      else {
        if (!object(cost)) fail();
        warnings.push(...unknownFields(cost, ['total_cost', 'cost_per_task'], 'index_cost'));
        optionalCost('intelligence_index_total_cost', cost.total_cost, 'USD');
        const task = cost.cost_per_task;
        if (task === undefined || task === null) warnings.push('Missing cost_per_task; metric omitted');
        else {
          if (!object(task)) fail();
          warnings.push(...unknownFields(task, ['total_cost'], 'cost_per_task'));
          optionalCost('intelligence_index_cost_per_task', task.total_cost, 'USD/task');
        }
      }
      if (!records.length) fail();
      return { ok: true, index, records, warnings };
    } catch { return { ok: false, index, reason: 'Artificial Analysis invalid-row', warnings }; }
  });
}
