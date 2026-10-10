import type { InsightRecord } from './record.js';

const dataUrl = 'https://cognition.com/data/frontiercode-leaderboard/data.json';
const revisions = ['v1', 'v1_1'] as const;
const metrics = {
  correct: ['ratio', true, false], new_score: ['ratio', true, false], cost: ['usd', false, false],
  tokens: ['tokens', false, false], duration_min: ['min', false, false],
  tool_calls: ['count', false, true], steps: ['count', false, true], flagged_rate: ['ratio', true, false],
} as const satisfies Record<string, readonly [string, boolean, boolean]>;
const allowed: readonly string[] = [...Object.keys(metrics), 'ote'];
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
function date(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const ms = Date.parse(v); return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v;
}
const timestamp = (v: unknown): v is string => typeof v === 'string' && date(v.slice(0, 10)) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
export class CognitionParseError extends Error {
  constructor(readonly code: 'invalid-row' | 'invalid-response') { super(`Cognition ${code}`); }
}
export type CognitionRowResult = { readonly ok: true; readonly index: number;
  readonly records: readonly InsightRecord[]; readonly warnings: readonly string[] } |
  { readonly ok: false; readonly index: number; readonly reason: string; readonly warnings: readonly string[] };
function unknownFields(row: Record<string, unknown>, keys: readonly string[], path: string): string[] {
  const count = Object.keys(row).filter(key => !keys.includes(key)).length;
  return count ? [`Ignored ${count} unknown fields at ${path}`] : [];
}
interface RowContext { readonly rev: string; readonly modelId: string; readonly effort: string;
  readonly subset: string; readonly harness: string | null; readonly observedAt: string; }
function parseRow(row: unknown, context: RowContext, index: number): CognitionRowResult {
  const warnings: string[] = [];
  try {
    if (!object(row)) throw new CognitionParseError('invalid-row');
    warnings.push(...unknownFields(row, allowed, 'metrics'));
    const records: InsightRecord[] = [];
    for (const [metric, [unit, ratio, integer]] of Object.entries(metrics)) {
      const value = row[metric];
      if (value === undefined || value === null) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
        (ratio && value > 1) || (integer && !Number.isInteger(value)))
        throw new CognitionParseError('invalid-row');
      records.push({ source: 'cognition', modelId: context.modelId, modelAlias: context.modelId, metric, value, unit,
        category: `${context.rev}/${context.effort}/${context.subset}`, observedAt: context.observedAt,
        sourceAsOf: context.observedAt, sourceUrl: dataUrl, sourceName: 'Cognition FrontierCode',
        license: null, method: 'official-dataset', schemaVersion: 'cognition-frontiercode-v1',
        attributionText: 'Source: Cognition FrontierCode (https://cognition.com/frontiercode). Internal use only.',
        metadata: { revision: context.rev, effort: context.effort, subset: context.subset,
          harness: context.harness, internalOnly: true, sourceAsOfBasis: 'observedAt-fallback' } });
    }
    if (!records.length) throw new CognitionParseError('invalid-row');
    return { ok: true, index, records, warnings };
  } catch { return { ok: false, index, reason: 'Cognition invalid-row', warnings }; }
}
/** FrontierCode mergeability data. JSON has no source-update timestamp: sourceAsOf
 * falls back to observedAt. Internal use only (license null). No HTTP here. */
export function parseCognitionResponse(payload: unknown, observedAt: string): readonly CognitionRowResult[] {
  if (!object(payload) || !timestamp(observedAt)) throw new CognitionParseError('invalid-response');
  const present = revisions.filter(rev => object(payload[rev]));
  if (!present.length) throw new CognitionParseError('invalid-response');
  for (const rev of present) {
    const node = payload[rev] as Record<string, unknown>;
    if (!Array.isArray(node.models) || !object(node.subsets) || !object(node.data))
      throw new CognitionParseError('invalid-response');
  }
  const results: CognitionRowResult[] = [];
  for (const rev of present) {
    const node = payload[rev] as Record<string, unknown>;
    const data = node.data as Record<string, unknown>;
    const harness = object(node.harness) ? node.harness : {};
    for (const modelId of Object.keys(data)) {
      const model = data[modelId];
      for (const effort of object(model) ? Object.keys(model) : []) {
        const effortNode = (model as Record<string, unknown>)[effort];
        for (const subset of object(effortNode) ? Object.keys(effortNode) : []) {
          results.push(parseRow((effortNode as Record<string, unknown>)[subset], {
            rev, modelId, effort, subset, harness: text(harness[modelId]) ? harness[modelId] : null,
            observedAt }, results.length));
        }
      }
    }
  }
  return results;
}
