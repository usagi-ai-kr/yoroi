import { expandSuccessors } from './model-successors.js';
import { validateInsightRecord, type ValidatedInsightRecord } from './validation.js';
import { isExcludedModel, olderGenerationModelIds } from './letter-top10-filter.js';
import { splitBaseAndEffort } from './letter-top10-group.js';
import { normalizeModelName, type Top10RecordInput } from './letter-top10-rank.js';
import { PLAN_CATALOG, type PlanCatalogEntry } from './plan-catalog.js';

/** AA 검증 기록에 모델 후속 행을 합쳐 Top10 후보를 만든다(지수·속도·공식 단가 행 포함).
 *  저장된 성공 캐시는 건드리지 않고 렌더 경로에서만 확장한다. */
export function withSuccessors(base: readonly ValidatedInsightRecord[]): ValidatedInsightRecord[] {
  const known = new Set(base.map(v => v.record.modelId));
  const added = expandSuccessors(base.map(v => v.record)).filter(r => !known.has(r.modelId))
    .flatMap(rec => { const v = validateInsightRecord(rec); return v.ok ? [v.value] : []; });
  return [...base, ...added];
}

const modelIdOf = (r: Top10RecordInput): string => normalizeModelName(splitBaseAndEffort(r.modelId).base);
export interface CandidatePool {
  readonly allRecords: readonly Top10RecordInput[];
  readonly accessibleRecords: readonly Top10RecordInput[];
  readonly supersededModelIds: ReadonlySet<string>;
}
/** Compute generation exclusions once from all AA-recorded, verified-plan models, independent of metric. */
export function buildCandidatePool(records: readonly Top10RecordInput[], catalog: readonly PlanCatalogEntry[] = PLAN_CATALOG): CandidatePool {
  const accessible = new Set(catalog.flatMap(p => p.models.filter(m => m.verified).map(m => normalizeModelName(m.modelId))));
  const modelIds = [...new Set(records.map(modelIdOf))].filter(id => accessible.has(id) && !isExcludedModel(id));
  const supersededModelIds = olderGenerationModelIds(modelIds);
  const allRecords = records.filter(r => !supersededModelIds.has(modelIdOf(r)));
  const accessibleRecords = allRecords.filter(r => accessible.has(modelIdOf(r)) && !isExcludedModel(r.modelId));
  return { allRecords, accessibleRecords, supersededModelIds };
}
