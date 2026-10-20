import {
  normalizeDiscoveryModelId,
  type DiscoveredModel,
  type DiscoveryDiffSummary,
  type ModelDiscoveryDiff,
  type ModelRegistrySnapshot,
} from './model-discovery-types.js';

/** 비교 대상 필드. 배열 필드는 집합 비교라 순서·중복만 다른 목록은 변경으로 보지 않는다. */
const COMPARED_FIELDS = ['displayName', 'sourceUrl', 'checkedOn', 'verified', 'planIds', 'free', 'efforts'] as const;
type ComparedField = (typeof COMPARED_FIELDS)[number];

/** 배열은 정렬·중복 제거 후 비교한다(순서·중복만 다른 목록 = 동일). */
const setKey = (values: readonly string[]): string => [...new Set(values.map(value => value.trim()))].sort().join('|');

function fieldValue(model: DiscoveredModel, field: ComparedField): string {
  switch (field) {
    case 'displayName': return model.displayName;
    case 'sourceUrl': return model.sourceUrl;
    case 'checkedOn': return model.checkedOn;
    case 'verified': return String(model.verified);
    case 'planIds': return setKey(model.planIds);
    case 'free': return String(model.free ?? false);
    case 'efforts': return setKey(model.efforts ?? []);
  }
}

/** id → 모델 + 중복 id 집합. 중복 id는 인덱스에서 제외하고 diff 전체에서 보류한다(모호 fail-closed). */
function indexById(models: readonly DiscoveredModel[]): { index: ReadonlyMap<string, DiscoveredModel>; dupes: ReadonlySet<string> } {
  const counts = new Map<string, number>();
  for (const model of models) {
    const key = normalizeDiscoveryModelId(model.modelId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const index = new Map<string, DiscoveredModel>(), dupes = new Set<string>();
  for (const model of models) {
    const key = normalizeDiscoveryModelId(model.modelId);
    if ((counts.get(key) ?? 0) > 1) dupes.add(key); else index.set(key, model);
  }
  return { index, dupes };
}

/** provider 한 개의 기준 대비 차이. id는 정규화 값의 정확 일치만 — 유사명 병합 없음.
 *  removed는 '이번 수집 부재' 표기이며 즉시 삭제하지 않는다(폐지 grace는 미결 정책). */
export function diffRegistry(providerId: string, observedAt: string,
  previous: readonly DiscoveredModel[], next: readonly DiscoveredModel[]): ModelDiscoveryDiff {
  const before = indexById(previous), after = indexById(next);
  const held = new Set([...before.dupes, ...after.dupes]);
  const added: DiscoveredModel[] = [], removed: string[] = [];
  const changed: { readonly modelId: string; readonly fields: readonly string[] }[] = [];
  for (const [id, model] of after.index) {
    if (held.has(id)) continue;
    const prior = before.index.get(id);
    if (prior === undefined) { added.push(model); continue; }
    const fields = COMPARED_FIELDS.filter(field => fieldValue(model, field) !== fieldValue(prior, field));
    if (fields.length > 0) changed.push({ modelId: model.modelId, fields: [...fields] });
  }
  for (const [id, model] of before.index) if (!held.has(id) && !after.index.has(id)) removed.push(model.modelId);
  return { providerId, observedAt, added, removed, changed };
}

/** provider별로 분리해 비교한다. 서로 다른 provider의 모델은 절대 섞이지 않는다. */
export function diffProviderSnapshots(previous: readonly ModelRegistrySnapshot[],
  next: readonly ModelRegistrySnapshot[]): readonly ModelDiscoveryDiff[] {
  const before = groupByProvider(previous), after = groupByProvider(next);
  const providerIds = [...new Set([...before.keys(), ...after.keys()])].sort();
  return providerIds.map(providerId => {
    const prior = before.get(providerId), current = after.get(providerId);
    return diffRegistry(providerId, current?.observedAt ?? prior?.observedAt ?? '',
      prior?.models ?? [], current?.models ?? []);
  });
}

function groupByProvider(snapshots: readonly ModelRegistrySnapshot[]): ReadonlyMap<string, ModelRegistrySnapshot> {
  const grouped = new Map<string, ModelRegistrySnapshot>();
  for (const snapshot of snapshots) if (!grouped.has(snapshot.providerId)) grouped.set(snapshot.providerId, snapshot);
  return grouped;
}

/** 차이 요약. stdout 1줄 렌더 입력. */
export function summarizeDiscoveryDiffs(diffs: readonly ModelDiscoveryDiff[]): DiscoveryDiffSummary {
  const observedAt = diffs.map(diff => diff.observedAt).filter(value => value !== '').sort().at(-1) ?? '';
  return {
    observedAt,
    providers: diffs.length,
    added: diffs.reduce((sum, diff) => sum + diff.added.length, 0),
    removed: diffs.reduce((sum, diff) => sum + diff.removed.length, 0),
    changed: diffs.reduce((sum, diff) => sum + diff.changed.length, 0),
  };
}
