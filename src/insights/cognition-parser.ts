import type { InsightRecord } from './record.js';
import { isObject, isText, isIsoTimestamp, isFiniteNumber, unknownFields,
  type ParseRowResult } from './parse-utils.js';
import { filterCognitionTop50 } from './cognition-top50.js';

const dataUrl = 'https://cognition.com/data/frontiercode-leaderboard/data.json';
const revisions = ['v1', 'v1_1'] as const;
const metrics = {
  correct: ['ratio', true, false], new_score: ['ratio', true, false], cost: ['usd', false, false],
  tokens: ['tokens', false, false], duration_min: ['min', false, false],
  tool_calls: ['count', false, true], steps: ['count', false, true], flagged_rate: ['ratio', true, false],
} as const satisfies Record<string, readonly [string, boolean, boolean]>;
const allowed: readonly string[] = [...Object.keys(metrics), 'ote'];
export class CognitionParseError extends Error {
  constructor(readonly code: 'invalid-row' | 'invalid-response') { super(`Cognition ${code}`); }
}
export type CognitionRowResult = ParseRowResult;
interface RowContext { readonly rev: string; readonly modelId: string; readonly effort: string;
  readonly subset: string; readonly harness: string | null; readonly observedAt: string; }
function parseRow(row: unknown, context: RowContext, index: number): CognitionRowResult {
  const warnings: string[] = [];
  try {
    if (!isObject(row)) throw new CognitionParseError('invalid-row');
    warnings.push(...unknownFields(row, allowed, 'metrics'));
    const records: InsightRecord[] = [];
    for (const [metric, [unit, ratio, integer]] of Object.entries(metrics)) {
      const value = row[metric];
      if (value === undefined || value === null) continue;
      if (!isFiniteNumber(value) || value < 0 || (ratio && value > 1) || (integer && !Number.isInteger(value)))
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
  if (!isObject(payload) || !isIsoTimestamp(observedAt)) throw new CognitionParseError('invalid-response');
  const present = revisions.filter(rev => isObject(payload[rev]));
  if (!present.length) throw new CognitionParseError('invalid-response');
  for (const rev of present) {
    const node = payload[rev] as Record<string, unknown>;
    if (!Array.isArray(node.models) || !isObject(node.subsets) || !isObject(node.data))
      throw new CognitionParseError('invalid-response');
  }
  const results: CognitionRowResult[] = [];
  for (const rev of present) {
    const node = payload[rev] as Record<string, unknown>;
    const data = node.data as Record<string, unknown>;
    const harness = isObject(node.harness) ? node.harness : {};
    for (const modelId of Object.keys(data)) {
      const model = data[modelId];
      for (const effort of isObject(model) ? Object.keys(model) : []) {
        const effortNode = (model as Record<string, unknown>)[effort];
        for (const subset of isObject(effortNode) ? Object.keys(effortNode) : []) {
          results.push(parseRow((effortNode as Record<string, unknown>)[subset], {
            rev, modelId, effort, subset, harness: isText(harness[modelId]) ? harness[modelId] : null,
            observedAt }, results.length));
        }
      }
    }
  }
  return filterCognitionTop50(results);
}
