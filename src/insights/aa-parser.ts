import type { InsightRecord } from './record.js';
import { isObject, isText, isIsoDate, isIsoTimestamp, isFiniteNumber, unknownFields,
  type ParseRowResult } from './parse-utils.js';

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
export class AaParseError extends Error {
  constructor(readonly code: 'invalid-row' | 'invalid-response') { super(`Artificial Analysis ${code}`); }
}
/** FrontierCode는 AA가 예고한 보조 지표(가칭). 이름에 frontiercode가 든 필드만 골라 같은 metric으로 적재한다. */
export const FRONTIERCODE_METRIC = 'frontiercode_score';
export type AaRowResult = ParseRowResult;
function fail(): never { throw new AaParseError('invalid-row'); }
/** Free-shape V2 metrics only; Pro additions are ignored with warnings.
 * No documented source-update timestamp: sourceAsOf explicitly falls back to observedAt. */
export function parseAaResponse(payload: unknown, observedAt: string): readonly AaRowResult[] {
  if (!isObject(payload) || !Array.isArray(payload.data) || !isIsoTimestamp(observedAt) ||
    !['free', 'pro', 'commercial'].includes(String(payload.tier)) ||
    !isFiniteNumber(payload.intelligence_index_version) ||
    !isObject(payload.pagination) || !['page', 'page_size', 'total_pages'].every(k =>
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
      if (!isObject(row) || !isText(row.id) || !isText(row.slug) || !isText(row.name) ||
        !isObject(row.model_creator) || !isText(row.model_creator.id) || !isText(row.model_creator.name) ||
        !(row.release_date === null || isIsoDate(row.release_date))) fail();
      const rowFcKeys = Object.keys(row).filter(key => key.toLowerCase().includes('frontiercode'));
      warnings.push(...unknownFields(row, ['id', 'slug', 'name', 'release_date', 'model_creator',
        ...Object.keys(fields), 'artificial_analysis_intelligence_index_cost', ...rowFcKeys], 'model'),
        ...unknownFields(row.model_creator, ['id', 'name'], 'model_creator'));
      const records: InsightRecord[] = [];
      const frontiercode: [string, unknown][] = [];
      for (const key of rowFcKeys) frontiercode.push([`model.${key}`, row[key]]);
      const add = (metric: string, value: unknown, unit: string) => {
        if (value === null) return;
        if (!isFiniteNumber(value) || (unit !== 'score' && value < 0)) fail();
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
        const values = row[group]; if (!isObject(values)) fail();
        const allowed = metrics.map(([name]) => name!);
        const fcKeys = group === 'evaluations' ? Object.keys(values).filter(key => key.toLowerCase().includes('frontiercode')) : [];
        warnings.push(...unknownFields(values, [...allowed, ...fcKeys], group));
        for (const [metric, unit] of metrics) if (metric! in values) add(metric!, values[metric!], unit!);
        for (const key of fcKeys) frontiercode.push([`${group}.${key}`, values[key]]);
      }
      const fcNumeric = frontiercode.find(([, value]) => isFiniteNumber(value));
      if (fcNumeric) {
        if (frontiercode.length > 1) warnings.push(`Multiple frontiercode fields; used ${fcNumeric[0]}`);
        add(FRONTIERCODE_METRIC, fcNumeric[1], 'score');
      } else if (frontiercode.length) warnings.push('frontiercode fields present but not numeric; ignored');
      const cost = row.artificial_analysis_intelligence_index_cost;
      const optionalCost = (metric: string, value: unknown, unit: string) => {
        if (value === undefined || value === null) warnings.push(`Missing ${metric}; metric omitted`);
        else add(metric, value, unit);
      };
      if (cost === undefined || cost === null) warnings.push('Missing index_cost; cost metrics omitted');
      else {
        if (!isObject(cost)) fail();
        warnings.push(...unknownFields(cost, ['total_cost', 'cost_per_task'], 'index_cost'));
        optionalCost('intelligence_index_total_cost', cost.total_cost, 'USD');
        const task = cost.cost_per_task;
        if (task === undefined || task === null) warnings.push('Missing cost_per_task; metric omitted');
        else {
          if (!isObject(task)) fail();
          warnings.push(...unknownFields(task, ['total_cost'], 'cost_per_task'));
          optionalCost('intelligence_index_cost_per_task', task.total_cost, 'USD/task');
        }
      }
      if (!records.length) fail();
      return { ok: true, index, records, warnings };
    } catch { return { ok: false, index, reason: 'Artificial Analysis invalid-row', warnings }; }
  });
}
