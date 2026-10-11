import { compareInsightPrevious, type ComparisonUnavailable } from './comparison.js';
import { validateInsightRecord, type ValidatedInsightRecord } from './validation.js';

export interface InsightRankSnapshot {
  readonly records: readonly ValidatedInsightRecord[];
  /** False for missing pages/failed rows/truncated cohorts; absence then proves no entry or exit. */
  readonly complete: boolean;
}
export interface InsightRankChange {
  readonly modelId: string;
  readonly status: 'ranked' | 'entered' | 'exited' | 'missing';
  readonly currentRank: number | null;
  readonly previousRank: number | null;
  /** Positive means moved upward. Unknown or incomparable ranks have no numeric change. */
  readonly rankChange: number | null;
  readonly missingFrom?: 'current' | 'previous' | 'cohort';
}
export type InsightRankResult = { readonly comparable: true; readonly changes: readonly InsightRankChange[] } |
  { readonly comparable: false; readonly reason: ComparisonUnavailable | 'n/a: 순위 자료 없음' |
    'n/a: 혼합 순위표' | 'n/a: 중복 모델' };
const groupFields = ['source', 'metric', 'category', 'schemaVersion', 'unit', 'method'] as const;
const other = (value: ValidatedInsightRecord): boolean => value.record.modelId.trim().toLowerCase() === 'other' ||
  value.record.metadata?.aggregate === true;
function cohortIssue(records: readonly ValidatedInsightRecord[]): 'n/a: 혼합 순위표' | 'n/a: 중복 모델' |
  'n/a: 유효하지 않은 자료' | undefined {
  const first = records[0]!;
  const ids = new Set<string>();
  for (const value of records) {
    const checked = validateInsightRecord(value.record);
    if (!checked.ok || checked.value.comparisonDate !== value.comparisonDate) return 'n/a: 유효하지 않은 자료';
    if (value.comparisonDate !== first.comparisonDate ||
      groupFields.some(field => value.record[field] !== first.record[field])) return 'n/a: 혼합 순위표';
    if (ids.has(value.record.modelId)) return 'n/a: 중복 모델';
    ids.add(value.record.modelId);
  }
  return undefined;
}
/** Competition ranking (1,1,3); exact numeric ties. Model id gives stable output order only. */
function ranks(records: readonly ValidatedInsightRecord[], order: 'ascending' | 'descending'): Map<string, number> {
  const sorted = [...records].sort((a, b) => (order === 'ascending' ? 1 : -1) *
    (a.record.value - b.record.value) || (a.record.modelId < b.record.modelId ? -1 : 1));
  const result = new Map<string, number>();
  let rank = 0;
  sorted.forEach((value, index) => {
    if (index === 0 || value.record.value !== sorted[index - 1]!.record.value) rank = index + 1;
    result.set(value.record.modelId, rank);
  });
  return result;
}
/** Caller supplies one requestScope per pair. Order is explicit: cost/rank and score differ.
 * Empty/other-only cohorts are insufficient evidence, never mass entries or exits. */
export function computeInsightRankChanges(current: InsightRankSnapshot, previous: InsightRankSnapshot | undefined,
  order: 'ascending' | 'descending'): InsightRankResult {
  const now = current.records.filter(value => !other(value));
  const before = previous?.records.filter(value => !other(value)) ?? [];
  if (!now.length) return { comparable: false, reason: 'n/a: 순위 자료 없음' };
  const anchor = now[0]!;
  const prior = before[0];
  // Compare group dates/identity via C1; model identity is intentionally removed for cohort anchors.
  // Zero values avoid irrelevant delta overflow while preserving all date/schema/unit checks.
  const gate = compareInsightPrevious({ ...anchor, record: { ...anchor.record, value: 0 } }, prior &&
    { ...prior, record: { ...prior.record, modelId: anchor.record.modelId, value: 0 } });
  if (!gate.comparable) return gate;
  const issue = cohortIssue(now) ?? cohortIssue(before);
  if (issue) return { comparable: false, reason: issue };
  const currentRanks = ranks(now, order), previousRanks = ranks(before, order);
  const changes = [...new Set([...currentRanks.keys(), ...previousRanks.keys()])].sort().map(modelId => {
    const c = currentRanks.get(modelId), p = previousRanks.get(modelId);
    const currentRank = current.complete ? c ?? null : null;
    const previousRank = previous!.complete ? p ?? null : null;
    if (c !== undefined && p !== undefined) {
      return current.complete && previous!.complete
        ? { modelId, status: 'ranked' as const, currentRank, previousRank, rankChange: p - c }
        : { modelId, status: 'missing' as const, currentRank, previousRank, rankChange: null, missingFrom: 'cohort' as const };
    }
    const entered = c !== undefined;
    const known = entered ? previous!.complete : current.complete;
    return { modelId, status: known ? (entered ? 'entered' as const : 'exited' as const) : 'missing' as const,
      currentRank, previousRank, rankChange: null,
      ...(!known ? { missingFrom: entered ? 'previous' as const : 'current' as const } : {}) };
  });
  return { comparable: true, changes };
}
