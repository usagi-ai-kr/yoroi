import { buildCatalogAliasResolver } from './model-aliases.js';
import { computeRoleTop10, type RoleLists } from './letter-top10-unified.js';
import { splitBaseAndEffort } from './letter-top10-group.js';
import type { PlanCatalogEntry } from './plan-catalog.js';
import { existsSync } from 'node:fs';
import { openDatabase } from '../infra/sqlite/database.js';
import { resolveDbPath } from '../infra/sqlite/data-dir.js';
import { CALIBRATION_TASK_SET_VERSION } from './calibration-task-set.js';
import type { CalibrationRunRecord } from './calibration-store.js';
import { SqliteCalibrationStore } from './calibration-store-sqlite.js';
import { normalizeModelName, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
import { freeCompactRows, freeMarkdownRows, FREE_TABLE_HEADER, withCalibration } from './letter-markdown-free-table.js';
import { freeRowsFrom } from './letter-markdown-free-sort.js';
export { barePlan, freeOnlyModelIds, shortPlan } from './letter-top10-plans.js';

export const FREE_HEADING = '## 🆓 Free 티어';
export const FREE_EMPTY_NOTE = 'Free 목록 수집 실패(opencode models)';
/** 티어별 한도·조건(Zen Free·Go Free 2줄). */
export const FREE_LIMIT_NOTES: readonly string[] = [
  '- OpenCode Zen Free: 기간 한정 무료(수치 한도 미공개), 수집 데이터가 모델 개선에 쓰일 수 있다(일부 zero-retention).',
  '- OpenCode Go Free: Unlimited·기간 한정, OpenCode 클라이언트 세션에서만 사용 가능.',
];

/** Free 섹션 목록은 렌더 입력의 freeCatalog(codex의 `opencode models` 실시간 수집)로만 만든다.
 *  비어 있으면 undefined → 섹션은 수집 실패 1줄만 표시한다. */
export const freeListsFrom = (records: readonly Top10RecordInput[], freeCatalog: readonly PlanCatalogEntry[] | undefined,
  opts?: Top10Options): RoleLists | undefined =>
  freeCatalog?.length ? computeRoleTop10(records, { ...opts, catalog: freeCatalog }) : undefined;

/** freeCatalog에는 있으나 순위를 매기지 못한 모델 ID(원 ID). 어느 소스 근거로든 Free 순위 표에 오른 모델(`ranked`)은
 *  미측정 행으로 다시 붙이지 않는다. */
export const unmeasuredFreeIds = (freeCatalog: readonly PlanCatalogEntry[] | undefined,
  records: readonly Top10RecordInput[], ranked?: RoleLists): readonly string[] => {
  if (!freeCatalog?.length) return [];
  const measured = new Set(records.filter(r => Number.isFinite(r.value))
    .map(r => normalizeModelName(splitBaseAndEffort(r.modelId).base)));
  for (const e of [...(ranked?.orchestrator.entries ?? []), ...(ranked?.worker.entries ?? [])]) measured.add(normalizeModelName(e.modelId));
  // 순위 표와 같은 별칭 해석(p29)을 써야 별칭으로 측정된 모델이 '미측정'에 함께 남지 않는다.
  const resolve = buildCatalogAliasResolver(records, freeCatalog.flatMap(p => p.models.map(m => m.modelId)));
  return [...new Set(freeCatalog.flatMap(p => p.models
    .filter(m => m.verified && !measured.has(resolve(normalizeModelName(m.modelId)))).map(m => m.modelId)))].sort();
};
export interface UnmeasuredFree { readonly modelId: string; readonly plans: readonly string[] }
/** 미측정 ID에 free 경로(플랜명)를 붙인다. 플랜 순서는 freeCatalog 순서다. */
export const unmeasuredFreeEntries = (freeCatalog: readonly PlanCatalogEntry[] | undefined,
  records: readonly Top10RecordInput[], ranked?: RoleLists): readonly UnmeasuredFree[] => unmeasuredFreeIds(freeCatalog, records, ranked).map(modelId => ({
    modelId, plans: (freeCatalog ?? []).filter(p => p.models.some(m => m.verified && m.modelId === modelId)).map(p => p.planName) }));

/** p75 B: 오케·워커 두 표를 모델 기준 한 표로 합친다(열: 모델·오케·워커·Free 경로·비고).
 *  셀은 통과 `✓ 스코어`, 근거 있고 미달 `✗`, 근거 없음 `-`. 정렬은 letter-markdown-free-sort가 담당한다. */
export type CalibrationLookup = (modelId: string) => readonly CalibrationRunRecord[] | undefined;
/** #180 unit 5: DB 파일이 있을 때만 저장소를 읽는다. 없으면 undefined(once에서 저장소 생성 없음). */
const lazyCalibrationLookup = (): CalibrationLookup | undefined => {
  let path: string;
  try { path = resolveDbPath(process.env); } catch { return undefined; }
  if (!existsSync(path)) return undefined;
  return (modelId: string) => {
    try {
      const store = new SqliteCalibrationStore(openDatabase(path, { migrations: [] }));
      try { return store.listRuns(normalizeModelName(modelId), CALIBRATION_TASK_SET_VERSION); }
      finally { store.close(); }
    } catch { return undefined; }
  };
};
export function renderFreeSectionMarkdown(lists: RoleLists | undefined,
  unmeasured: readonly UnmeasuredFree[] = [], _limit = 5, calibration?: CalibrationLookup): string[] {
  if (!lists) return [FREE_HEADING, '', FREE_EMPTY_NOTE];
  const rows = withCalibration(freeRowsFrom(lists, unmeasured, Infinity), calibration ?? lazyCalibrationLookup());
  return [FREE_HEADING, '', FREE_TABLE_HEADER, ...freeMarkdownRows(rows), '', ...FREE_LIMIT_NOTES];
}
export function renderFreeSectionCompact(lists: RoleLists | undefined,
  unmeasured: readonly UnmeasuredFree[] = [], limit = 3): string[] {
  if (!lists) return [FREE_HEADING, FREE_EMPTY_NOTE];
  return [FREE_HEADING, ...freeCompactRows(freeRowsFrom(lists, unmeasured, limit)), ...FREE_LIMIT_NOTES];
}
