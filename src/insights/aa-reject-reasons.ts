import { isFiniteNumber, isIsoDate, isObject, isText } from './parse-utils.js';

/** AA metric table (moved here so the classifier shares one definition; parser imports it). */
const indices = ['intelligence', 'coding', 'agentic', 'finance_and_accounting',
  'strategy_and_ops', 'legal', 'healthcare_and_medical', 'engineering', 'economics']
  .map(name => `artificial_analysis_${name}_index`);
export const aaMetricFields = {
  evaluations: indices.map(name => [name, 'score']),
  pricing: ['input', 'output', 'cache_hit', 'cache_write'].map(name => [`price_1m_${name}_tokens`, 'USD/1M tokens']),
  performance: [['median_output_tokens_per_second', 'tokens/s'],
    ...['time_to_first_token', 'time_to_first_answer_token', 'end_to_end_response_time']
      .map(name => [`median_${name}_seconds`, 'seconds'])],
} as const;

/** Sanitized AA row-rejection codes. Fixed union — kind count is capped by construction. */
export type AaRejectCode = 'missing-id' | 'missing-creator' | 'bad-date' | 'bad-group' | 'bad-number' | 'no-measurement';
export interface AaRejectDetail { readonly code: AaRejectCode; readonly fields: readonly string[]; }

/** Field names come from fixed parser tables only — kinds capped, raw values never recorded. */
const textFields = (row: Record<string, unknown>, keys: readonly string[]): string[] =>
  keys.filter(key => !isText(row[key]));
const metricFail = (values: Record<string, unknown>, metrics: ReadonlyArray<ReadonlyArray<string>>): string | undefined => {
  for (const [metric, unit] of metrics) {
    if (typeof metric !== 'string' || !(metric in values)) continue;
    const value = values[metric];
    if (value === null) continue;
    if (!isFiniteNumber(value) || (unit !== 'score' && value < 0)) return metric;
  }
  return undefined;
};
const costFail = (cost: unknown): string | undefined => {
  if (cost === undefined || cost === null) return undefined;
  if (!isObject(cost)) return 'artificial_analysis_intelligence_index_cost';
  const check = (metric: string, value: unknown, unit: string): string | undefined =>
    (value === undefined || value === null) ? undefined :
    ((!isFiniteNumber(value) || (unit !== 'score' && value < 0)) ? metric : undefined);
  return check('artificial_analysis_intelligence_index_cost.total_cost', cost.total_cost, 'USD') ??
    ((): string | undefined => {
      const task = (cost as Record<string, unknown>).cost_per_task;
      if (task === undefined || task === null) return undefined;
      if (!isObject(task)) return 'artificial_analysis_intelligence_index_cost.cost_per_task';
      return check('artificial_analysis_intelligence_index_cost.cost_per_task.total_cost', (task as Record<string, unknown>).total_cost, 'USD/task');
    })();
};

/** Classify an already-rejected AA row by re-walking parser branches (read-only; decisions unchanged). */
export function classifyAaReject(row: unknown): AaRejectDetail {
  if (!isObject(row)) return { code: 'missing-id', fields: [] };
  const identity = textFields(row, ['id', 'slug', 'name']);
  if (identity.length) return { code: 'missing-id', fields: identity };
  if (!isObject(row.model_creator)) return { code: 'missing-creator', fields: ['model_creator'] };
  const creator = textFields(row.model_creator, ['id', 'name']).map(key => `model_creator.${key}`);
  if (creator.length) return { code: 'missing-creator', fields: creator };
  if (!(row.release_date === null || isIsoDate(row.release_date))) return { code: 'bad-date', fields: ['release_date'] };
  for (const [group, metrics] of Object.entries(aaMetricFields)) {
    const values = row[group];
    if (!isObject(values)) return { code: 'bad-group', fields: [group] };
    const bad = metricFail(values, metrics);
    if (bad) return { code: 'bad-number', fields: [bad] };
  }
  const costBad = costFail(row.artificial_analysis_intelligence_index_cost);
  if (costBad) return { code: 'bad-number', fields: [costBad] };
  return { code: 'no-measurement', fields: [] };
}

/** Runtime allowlist: only these names may enter diagnostics (fixed tables + cost contract names). */
const ALLOWED_FIELDS: ReadonlySet<string> = new Set<string>(['id', 'slug', 'name', 'model_creator',
  'model_creator.id', 'model_creator.name', 'release_date', 'evaluations', 'pricing', 'performance',
  'artificial_analysis_intelligence_index_cost',
  'artificial_analysis_intelligence_index_cost.total_cost',
  'artificial_analysis_intelligence_index_cost.cost_per_task',
  'artificial_analysis_intelligence_index_cost.cost_per_task.total_cost',
  ...Object.values(aaMetricFields).flatMap(metrics => metrics.map(([name]) => String(name)))]);
const AA_REJECT_CODES: ReadonlySet<string> = new Set(['missing-id', 'missing-creator', 'bad-date',
  'bad-group', 'bad-number', 'no-measurement', 'other']);

/** Enforce code enum + field allowlist at the validation boundary. Unknown → 'other', off-list fields dropped. */
export function sanitizeAaReject(input: { readonly code: unknown; readonly fields: unknown })
  : { readonly code: string; readonly fields: ReadonlyArray<string> } {
  const code = typeof input.code === 'string' && AA_REJECT_CODES.has(input.code) ? input.code : 'other';
  const fields = Array.isArray(input.fields)
    ? input.fields.filter((f): f is string => typeof f === 'string' && ALLOWED_FIELDS.has(f)) : [];
  return { code, fields };
}
export function countAaRejects(details: ReadonlyArray<{ readonly code: string; readonly fields: ReadonlyArray<string> }>)
  : { readonly codes: Readonly<Record<string, number>>; readonly fields: Readonly<Record<string, number>> } {
  const codes: Record<string, number> = {};
  const fields: Record<string, number> = {};
  for (const detail of details) {
    codes[detail.code] = (codes[detail.code] ?? 0) + 1;
    for (const field of detail.fields) fields[field] = (fields[field] ?? 0) + 1;
  }
  return { codes, fields };
}
