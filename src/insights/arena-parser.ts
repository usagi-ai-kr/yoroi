import type { InsightRecord } from './record.js';
import { isObject, isIsoDate, isIsoTimestamp, isFiniteNumber, type ParseRowResult } from './parse-utils.js';

const sourceUrl = 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset';
const sourceName = 'lmarena-ai LMArena Leaderboard Dataset';
const datasetLicense = 'CC-BY-4.0';
const common = ['model_name', 'organization', 'license', 'rank', 'category', 'leaderboard_publish_date'];
const standard = ['rating', 'rating_lower', 'rating_upper', 'variance', 'vote_count'];
const agent = ['score', 'score_ci_lower', 'score_ci_upper', 'observation_count'];
const standardMetrics = [
  ['rating', 'score'], ['rating_lower', 'score'], ['rating_upper', 'score'],
  ['variance', 'score-squared'], ['vote_count', 'battles'], ['rank', 'rank'],
] as const;
const agentMetrics = [
  ['score', 'score'], ['score_ci_lower', 'score'], ['score_ci_upper', 'score'],
  ['observation_count', 'observations'], ['session_count', 'sessions'], ['rank', 'rank'],
] as const;

export class ArenaParseError extends Error {
  constructor(readonly code: 'invalid-row' | 'schema-change') {
    super(`Arena row ${code}`);
  }
}
export type ArenaRowResult = ParseRowResult;

function fail(code: ArenaParseError['code']): never { throw new ArenaParseError(code); }
function isAgentRow(row: Record<string, unknown>): boolean { return !('rating' in row) && 'score' in row; }
function allowedColumns(row: unknown): ReadonlySet<string> {
  if (!isObject(row)) return new Set();
  return new Set([...common, ...(isAgentRow(row) ? agent : standard), ...(isAgentRow(row) ? ['session_count'] : [])]);
}

export function parseArenaRow(row: unknown, observedAt: string): readonly InsightRecord[] {
  if (!isObject(row) || !isIsoTimestamp(observedAt)) fail('invalid-row');
  const isAgent = isAgentRow(row);
  const requiredMetrics = isAgent ? agent : standard;
  const metrics = isAgent ? agentMetrics : standardMetrics;
  const required = [...common, ...requiredMetrics];
  if (required.some(key => !(key in row))) fail('invalid-row');
  if (isAgent === ('rating' in row)) fail('schema-change');
  for (const key of ['model_name', 'organization', 'license', 'category']) {
    if (typeof row[key] !== 'string' || (key !== 'license' && !row[key].trim())) fail('invalid-row');
  }
  const asOf = row.leaderboard_publish_date;
  if (!isIsoDate(asOf)) fail('invalid-row');
  for (const [key] of metrics) {
    if (key === 'session_count' && !(key in row)) continue;
    const value = row[key];
    const integer = ['rank', 'vote_count', 'observation_count', 'session_count'].includes(key);
    if (!isFiniteNumber(value) || (integer && !Number.isInteger(value))) fail('invalid-row');
  }
  return metrics.filter(([key]) => key in row).map(([metric, unit]) => ({
    source: 'arena', modelId: row.model_name as string, metric,
    value: row[metric] as number, unit, category: row.category as string,
    metadata: { organization: row.organization as string, modelLicense: row.license as string },
    observedAt, sourceAsOf: asOf, sourceUrl, sourceName, license: datasetLicense,
    attributionText: `Source: ${sourceName} (${datasetLicense}), ${sourceUrl}`,
    method: isAgent ? 'ips' : 'bradley-terry', schemaVersion: 'arena-hf-v1',
  }));
}

export function parseArenaRows(rows: readonly unknown[], observedAt: string): readonly ArenaRowResult[] {
  return rows.map((row, index) => {
    const allowed = allowedColumns(row);
    const unknown = isObject(row) ? Object.keys(row).filter(key => !allowed.has(key)) : [];
    const warnings = unknown.length ? [`Ignored unknown columns: ${unknown.join(', ')}`] : [];
    try { return { ok: true, index, records: parseArenaRow(row, observedAt), warnings }; }
    catch (error) {
      const reason = error instanceof ArenaParseError ? error.message : 'Arena row invalid-row';
      return { ok: false, index, reason, warnings };
    }
  });
}
