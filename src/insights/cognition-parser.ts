import type { InsightRecord } from './record.js';
import { isObject, isText, isIsoTimestamp, isFiniteNumber, unknownFields,
  type ParseRowResult } from './parse-utils.js';
const dataUrl = 'https://cognition.com/data/frontiercode-leaderboard/data.json';
/** 전체 revision/effort/subset·model 저장용 request scope. 기존 top50 캐시와 구분한다(p5 설계 §1). */
export const COGNITION_FULL_REQUEST_SCOPE = 'frontiercode:data-json:all';
/** v1_1(FrontierCode 1.1) 우선. v1은 v1_1이 없거나 data가 비었을 때만 fallback이며 두 리비전을 섞지 않는다. */
const revisions = ['v1_1', 'v1'] as const;
const schemaVersionOf = (rev: string): string => `cognition-frontiercode-${rev}`;
const metrics = {
  correct: ['ratio', true, false], new_score: ['ratio', true, false], cost: ['usd', false, false],
  tokens: ['tokens', false, false], duration_min: ['min', false, false],
  tool_calls: ['count', false, false], steps: ['count', false, false], flagged_rate: ['ratio', true, false],
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
        license: null, method: 'official-dataset', schemaVersion: schemaVersionOf(context.rev),
        attributionText: 'Source: Cognition FrontierCode (https://cognition.com/frontiercode). Internal use only.',
        metadata: { revision: context.rev, effort: context.effort, subset: context.subset,
          harness: context.harness, internalOnly: true, sourceAsOfBasis: 'observedAt-fallback' } });
    }
    if (!records.length) throw new CognitionParseError('invalid-row');
    return { ok: true, index, records, warnings };
  } catch { return { ok: false, index, reason: 'Cognition invalid-row', warnings }; }
}
/** FrontierCode mergeability data. JSON has no source-update timestamp: sourceAsOf
 * falls back to observedAt. Internal use only (license null). No HTTP here.
 * `tool_calls`·`steps`는 리비전별 평균값이라 소수를 허용한다(정수 단언은 v1_1 전체 행을 거절했다).
 * schemaVersion은 사용한 리비전에 맞춘다(v1_1 → `cognition-frontiercode-v1_1`).
 * 저장 경로는 rev/effort/subset·model 전체 rows를 컷 없이 반환한다(top50 선택은 cognition-top50이 조회용). */
export function parseCognitionResponse(payload: unknown, observedAt: string): readonly CognitionRowResult[] {
  if (!isObject(payload) || !isIsoTimestamp(observedAt)) throw new CognitionParseError('invalid-response');
  const present = revisions.filter(rev => isObject(payload[rev]));
  if (!present.length) throw new CognitionParseError('invalid-response');
  for (const rev of present) {
    const node = payload[rev] as Record<string, unknown>;
    if (!Array.isArray(node.models) || !isObject(node.subsets) || !isObject(node.data))
      throw new CognitionParseError('invalid-response');
  }
  const rowsOf = (rev: string): Record<string, unknown> =>
    ((payload[rev] as Record<string, unknown>).data as Record<string, unknown>);
  const rev = present.find(candidate => Object.keys(rowsOf(candidate)).length > 0);
  if (rev === undefined) return [];
  const node = payload[rev] as Record<string, unknown>;
  const data = rowsOf(rev), harness = isObject(node.harness) ? node.harness : {};
  const results: CognitionRowResult[] = [];
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
  return results;
}
