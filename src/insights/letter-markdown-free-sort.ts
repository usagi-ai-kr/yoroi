import type { RoleEntry, RoleLists } from './letter-top10-unified.js';
import { effortCell } from './letter-markdown-tables.js';

/** p75 B: Free 한 표의 행 모델과 정렬. 오케·워커 두 목록을 모델 기준으로 합친다. */
export interface FreeCell { readonly score: string; readonly passed: boolean;
  /** 비교 키: o/w는 1자리(표시 2자리와 분리), reviewer는 기존 2자리. 없으면 score 파싱. */
  readonly sortScore?: number | undefined }
/** 리뷰어 근거 1건. 점수는 완전한 근거가 있을 때만 들어오고, 렌더는 값을 만들지 않는다. */
export interface FreeReviewerEntry { readonly modelId: string; readonly score: string; readonly passed: boolean; readonly isPareto?: boolean }
export interface FreeRow {
  readonly modelId: string;
  readonly plans: readonly string[];
  readonly orchestrator?: FreeCell | undefined;
  readonly reviewer?: FreeCell | undefined;
  readonly worker?: FreeCell | undefined;
  readonly pareto: boolean;
  readonly effort?: string | undefined;
  readonly indexText?: string | undefined;
  readonly unmeasured: boolean;
}
export interface UnmeasuredRow { readonly modelId: string; readonly plans: readonly string[] }

/** 표시 문자열 파싱(기존 동작 보존용 폴백). '-'·비유한은 undefined. */
const parsedScore = (score?: string): number | undefined => {
  const value = score === undefined || score === '-' ? undefined : Number(score);
  return value !== undefined && Number.isFinite(value) ? value : undefined;
};
/** Free 표 파레토(현 상태 유지): 무료 모델은 단가가 모두 0이라 스코어가 엄격히 더 높은 free 모델이 없을 때만 표시한다. */
const starsOf = (entries: readonly RoleEntry[]): ReadonlySet<string> => {
  const values = entries.map(e => [e.modelId, e.scoreKey ?? parsedScore(e.scoreText)] as const);
  return new Set(values.filter(([id, value]) => value !== undefined &&
    !values.some(([other, ov]) => other !== id && ov !== undefined && ov > value)).map(([id]) => id));
};
interface Builder { plans: readonly string[]; orchestrator?: FreeCell; reviewer?: FreeCell; worker?: FreeCell; pareto?: boolean; effort?: string; indexText?: string; unmeasured?: boolean }
/** 두 역할의 랭크 행(limit 밖 포함)과 미측정 행을 모델 기준으로 합친다(같은 모델은 한 행).
 *  p78 2a: 랭크된 모델은 limit과 무관하게 행이 되고, 한 역할에만 랭크된 모델의 반대 칸은 근거가 있으므로 ✗다. */
export function freeRowsFrom(lists: RoleLists, unmeasured: readonly UnmeasuredRow[], limit: number,
  reviewer: readonly FreeReviewerEntry[] = []): FreeRow[] {
  const rows = new Map<string, Builder>();
  const at = (modelId: string, plans: readonly string[]): Builder =>
    rows.get(modelId) ?? (rows.set(modelId, { plans }).get(modelId) as Builder);
  for (const role of ['orchestrator', 'worker'] as const) {
    const stars = starsOf(lists[role].entries);
    for (const entry of lists[role].entries.slice(0, limit)) {
      const row = at(entry.modelId, entry.plans);
      const cell: FreeCell = { score: entry.scoreText ?? '-', passed: !entry.belowZone, sortScore: entry.scoreKey };
      if (role === 'orchestrator') row.orchestrator = cell; else row.worker = cell;
      row.effort ??= effortCell(entry); // #188: Free도 역할 표와 같은 가용성 표기(상한·미확인·벤치마크)를 쓴다.
      row.indexText ??= entry.indexText;
      row.pareto = row.pareto === true || stars.has(entry.modelId);
    }
  }
  for (const item of unmeasured) {
    const row = at(item.modelId, item.plans);
    row.plans = item.plans;
    row.unmeasured = true;
  }
  for (const entry of reviewer) {
    // ranked·미측정 verified Free 행에만 병합한다. 모르는 id로 새 행을 만들지 않는다.
    // 행 키는 base형·-free형이 섞이므로 정확히 먼저, 없으면 -free를 뗀 키로 합친다.
    // reviewer-only 근거는 미측정 verified Free 행에 결합할 수 있다.
    const row = rows.get(entry.modelId) ?? rows.get(entry.modelId.replace(/-free$/, ''));
    if (!row) continue;
    row.reviewer = { score: entry.score, passed: entry.passed, sortScore: Number(entry.score) };
    if (entry.isPareto === true) row.pareto = true;
  }
  const missing: FreeCell = { score: '-', passed: false }; // 근거는 있는데 이 역할 목록에 없는 경우(하한 탈락 등)
  for (const row of rows.values()) {
    if (row.unmeasured === true) continue;
    row.orchestrator ??= missing;
    row.worker ??= missing;
  }
  return freeRowOrder([...rows].map(([modelId, row]) => ({ modelId, plans: row.plans,
    ...(row.orchestrator && { orchestrator: row.orchestrator }), ...(row.reviewer && { reviewer: row.reviewer }),
    ...(row.worker && { worker: row.worker }),
    pareto: row.pareto === true, ...(row.effort && { effort: row.effort }),
    ...(row.indexText !== undefined && { indexText: row.indexText }), unmeasured: row.unmeasured === true })));
}
const roleCells = (row: FreeRow): readonly (FreeCell | undefined)[] => [row.orchestrator, row.reviewer, row.worker];
/** #246: passed 역할 수. 모델명 하드코딩 없이 FreeCell만 쓴다. */
const passedCount = (row: FreeRow): number => roleCells(row).filter(c => c?.passed === true).length;
/** 셀 비교값: 명시 키 우선, 없으면 표시 파싱(기존 동작). */
const cellKey = (cell?: FreeCell): number | undefined => cell?.sortScore ?? parsedScore(cell?.score);
/** #246: passed 셀 중 최고 비교 점수. 없으면 -Infinity. */
const bestScore = (row: FreeRow): number => {
  const scores = roleCells(row).filter((c): c is FreeCell => c?.passed === true).map(c => cellKey(c))
    .filter((v): v is number => v !== undefined && Number.isFinite(v));
  return scores.length ? Math.max(...scores) : -Infinity;
};
/** 정렬: ① passed 역할 수↓ ② 최고 점수↓ ③ 점수 없는 미측정 행은 아래로 ④ 모델명↑. */
export const freeRowOrder = (rows: readonly FreeRow[]): FreeRow[] => [...rows].sort((a, b) =>
  passedCount(b) - passedCount(a) || bestScore(b) - bestScore(a) ||
  Number(a.unmeasured === true) - Number(b.unmeasured === true) || a.modelId.localeCompare(b.modelId));
