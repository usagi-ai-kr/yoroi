import { expandSuccessors } from './model-successors.js';
import { validateInsightRecord, type ValidatedInsightRecord } from './validation.js';
import { isExcludedModel, olderGenerationModelIds } from './letter-top10-filter.js';
import { effortForModel, splitBaseAndEffort, type ModelVariant } from './letter-top10-group.js';
import { buildVariants, normalizeModelName, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
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
const effortOf = (r: Top10RecordInput): string => effortForModel(r.modelId, r.modelAlias);
function canonicalId(r: Top10RecordInput, catalogIds: ReadonlyMap<string, string>): string {
  const { effort: slugEffort } = splitBaseAndEffort(r.modelId), base = catalogIds.get(modelIdOf(r)) ?? modelIdOf(r);
  return slugEffort === 'default' ? base : `${base}-${slugEffort}`;
}
function dedupeRecords(records: readonly Top10RecordInput[], catalogIds: ReadonlyMap<string, string>): Top10RecordInput[] {
  const grouped = new Map<string, Top10RecordInput[]>();
  for (const r of records) {
    const base = catalogIds.get(modelIdOf(r)) ?? modelIdOf(r);
    const key = JSON.stringify([base, r.metric ?? '', effortOf(r)]);
    grouped.set(key, [...(grouped.get(key) ?? []), r]);
  }
  return [...grouped.values()].map(rows => {
    const sorted = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.modelId.localeCompare(b.modelId));
    const primary = sorted[0]!, priced = sorted.find(r => Number.isFinite(r.priceInput) && Number.isFinite(r.priceOutput));
    return { ...primary, modelId: canonicalId(primary, catalogIds),
      ...(primary.modelAlias === undefined && rows.find(r => r.modelAlias !== undefined)?.modelAlias !== undefined &&
        { modelAlias: rows.find(r => r.modelAlias !== undefined)!.modelAlias }),
      ...(priced && { priceInput: priced.priceInput, priceOutput: priced.priceOutput }),
      ...(primary.successorOf === undefined && rows.find(r => r.successorOf !== undefined)?.successorOf !== undefined &&
        { successorOf: rows.find(r => r.successorOf !== undefined)!.successorOf }) };
  }).sort((a, b) => a.modelId.localeCompare(b.modelId) || (a.metric ?? '').localeCompare(b.metric ?? ''));
}
export interface CandidatePool {
  readonly allRecords: readonly Top10RecordInput[];
  readonly accessibleRecords: readonly Top10RecordInput[];
  readonly supersededModelIds: ReadonlySet<string>;
}
/** Compute generation exclusions once from all AA-recorded, verified-plan models, independent of metric. */
export function buildCandidatePool(records: readonly Top10RecordInput[], catalog: readonly PlanCatalogEntry[] = PLAN_CATALOG): CandidatePool {
  const accessible = new Set(catalog.flatMap(p => p.models.filter(m => m.verified).map(m => normalizeModelName(m.modelId))));
  const catalogIds = new Map(catalog.flatMap(p => p.models.filter(m => m.verified)
    .map(m => [normalizeModelName(m.modelId), m.modelId] as const)));
  const modelIds = [...new Set(records.map(modelIdOf))].filter(id => accessible.has(id) && !isExcludedModel(id));
  const supersededModelIds = new Set(olderGenerationModelIds(modelIds));
  for (const r of records) if (r.successorOf !== undefined && accessible.has(modelIdOf(r)))
    supersededModelIds.add(normalizeModelName(splitBaseAndEffort(r.successorOf).base));
  const allRecords = dedupeRecords(records.filter(r => !supersededModelIds.has(modelIdOf(r))), catalogIds);
  const accessibleRecords = allRecords.filter(r => accessible.has(modelIdOf(r)) && !isExcludedModel(r.modelId));
  return { allRecords, accessibleRecords, supersededModelIds };
}

const AA_METRICS = new Set(['artificial_analysis_intelligence_index', 'artificial_analysis_coding_index',
  'median_output_tokens_per_second', 'intelligence_index_cost_per_task']);
/** Keep AA-recorded candidates without this role's index as zero-index fallback variants. */
export function buildRoleVariants(records: readonly Top10RecordInput[], metric: string, opts?: Top10Options): ModelVariant[] {
  const indexed = buildVariants(records, metric, opts), known = new Set(indexed.map(v => normalizeModelName(v.baseModelId)));
  const missing = new Map<string, Top10RecordInput>();
  for (const r of records) {
    if (r.metric && !AA_METRICS.has(r.metric)) continue;
    const key = modelIdOf(r);
    if (known.has(key)) continue;
    const prior = missing.get(key), priced = r.priceInput !== undefined && r.priceOutput !== undefined;
    if (!prior || priced && (prior.priceInput === undefined || prior.priceOutput === undefined)) missing.set(key, r);
  }
  const placeholders = [...missing.values()].map(r => ({ ...r, metric, value: 0 })), ids = new Set(missing.keys());
  const variants = buildVariants([...placeholders, ...records], metric, opts).filter(v => ids.has(normalizeModelName(v.baseModelId)))
    .map(v => ({ ...v, value: 0, indexMissing: true }));
  return [...indexed, ...variants];
}

/** Resolve plan labels against an injected catalog so paid/free views share candidate selection. */
export function plansForCatalogModel(modelId: string, catalog: readonly PlanCatalogEntry[]): string[] {
  const id = normalizeModelName(modelId);
  return catalog.flatMap(plan => {
    const entry = plan.models.find(m => m.verified && normalizeModelName(m.modelId) === id);
    if (!entry) return [];
    const label = plan.usagePolicy ? `${plan.planName}(크레딧 ${plan.usagePolicy.credit})` : plan.planName;
    if (!entry.usageLimit) return [label];
    const { count, period, note } = entry.usageLimit;
    return [`${label}(${count}회/${period}${note && /est\./i.test(note) ? '·추정' : ''})`];
  });
}
