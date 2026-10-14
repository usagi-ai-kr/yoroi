import type { RoleEntry, RoleLists } from './letter-top10-unified.js';

/** p75 B: Free 한 표의 행 모델과 정렬. 오케·워커 두 목록을 모델 기준으로 합친다. */
export interface FreeCell { readonly score: string; readonly passed: boolean }
export interface FreeRow {
  readonly modelId: string;
  readonly plans: readonly string[];
  readonly orchestrator?: FreeCell | undefined;
  readonly worker?: FreeCell | undefined;
  readonly pareto: boolean;
  readonly effort?: string | undefined;
  readonly unmeasured: boolean;
}
export interface UnmeasuredRow { readonly modelId: string; readonly plans: readonly string[] }

const scoreOf = (e: RoleEntry): number | undefined => {
  const value = Number(e.scoreText);
  return e.scoreText !== undefined && e.scoreText !== '-' && Number.isFinite(value) ? value : undefined;
};
/** Free 표 파레토(현 상태 유지): 무료 모델은 단가가 모두 0이라 스코어가 엄격히 더 높은 free 모델이 없을 때만 표시한다. */
const starsOf = (entries: readonly RoleEntry[]): ReadonlySet<string> => {
  const values = entries.map(e => [e.modelId, scoreOf(e)] as const);
  return new Set(values.filter(([id, value]) => value !== undefined &&
    !values.some(([other, ov]) => other !== id && ov !== undefined && ov > value)).map(([id]) => id));
};
interface Builder { plans: readonly string[]; orchestrator?: FreeCell; worker?: FreeCell; pareto?: boolean; effort?: string; unmeasured?: boolean }
/** 두 역할의 상위 limit개와 미측정 행을 모델 기준으로 합친다(같은 모델은 한 행). */
export function freeRowsFrom(lists: RoleLists, unmeasured: readonly UnmeasuredRow[], limit: number): FreeRow[] {
  const rows = new Map<string, Builder>();
  const at = (modelId: string, plans: readonly string[]): Builder =>
    rows.get(modelId) ?? (rows.set(modelId, { plans }).get(modelId) as Builder);
  for (const role of ['orchestrator', 'worker'] as const) {
    const stars = starsOf(lists[role].entries);
    for (const entry of lists[role].entries.slice(0, limit)) {
      const row = at(entry.modelId, entry.plans);
      const cell: FreeCell = { score: entry.scoreText ?? '-', passed: !entry.belowZone };
      if (role === 'orchestrator') row.orchestrator = cell; else row.worker = cell;
      row.effort ??= entry.repEffort;
      row.pareto = row.pareto === true || stars.has(entry.modelId);
    }
  }
  for (const item of unmeasured) {
    const row = at(item.modelId, item.plans);
    row.plans = item.plans;
    row.unmeasured = true;
  }
  return freeRowOrder([...rows].map(([modelId, row]) => ({ modelId, plans: row.plans,
    ...(row.orchestrator && { orchestrator: row.orchestrator }), ...(row.worker && { worker: row.worker }),
    pareto: row.pareto === true, ...(row.effort && { effort: row.effort }), unmeasured: row.unmeasured === true })));
}
const tier = (row: FreeRow): number => row.orchestrator?.passed ? 0 : row.worker?.passed ? 1 : 2;
const scoreNum = (cell?: FreeCell): number => cell?.passed && Number.isFinite(Number(cell.score)) ? Number(cell.score) : -Infinity;
/** 정렬: 오케 통과 → 워커 통과 → 나머지, 각각 오케 스코어↓ → 워커 스코어↓ → 모델명. */
export const freeRowOrder = (rows: readonly FreeRow[]): FreeRow[] => [...rows].sort((a, b) =>
  tier(a) - tier(b) || scoreNum(b.orchestrator) - scoreNum(a.orchestrator) || scoreNum(b.worker) - scoreNum(a.worker) ||
  a.modelId.localeCompare(b.modelId));
