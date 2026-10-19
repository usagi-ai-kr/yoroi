import { PARETO_MARK } from './letter-top10-legend.js';
import type { CalibrationRunRecord } from './calibration-store.js';
import type { FreeCell, FreeRow } from './letter-markdown-free-sort.js';

/** p75 B: Free 경로 칸(알려진 free 플랜명 + 공식 근거 주의)과 한 표 렌더. */
const PATH: Readonly<Record<string, string>> = {
  'OpenCode Zen Free': 'OpenCode Zen Free',
  'OpenCode Go Free': 'OpenCode Go Free',
};
export const pathOf = (plans: readonly string[]): string => plans.map(plan => PATH[plan] ?? plan).join('+');
export const FREE_TABLE_HEADER = '| 모델 | 오케 | 워커 | AA 지수 | Free 경로 | 비고 | 작업 가능성 |\n| --- | --- | --- | --- | --- | --- | --- |';
/** 영역 칸: 자격 통과 `✓ 스코어`, 근거는 있고 미달 `✗`, 근거 없음 `-`. */
export const freeCell = (cell?: FreeCell): string => cell === undefined ? '-' : cell.passed ? `✓ ${cell.score}` : '✗';
/** 비고: 파레토·effort, 미측정은 '근거 없음'. */
export const freeNote = (row: FreeRow): string => row.unmeasured ? '근거 없음'
  : [row.pareto ? `${PARETO_MARK} 파레토` : '', row.effort ? `effort ${row.effort}` : ''].filter(Boolean).join(' · ') || '-';
/** #180 unit 5: 작업 가능성 보충칸. scorer 판정 우선, 잠정은 잠정 표기. */
export type CalibratedFreeRow = FreeRow & { readonly calibration?: readonly CalibrationRunRecord[] };
const calOf = (row: FreeRow): readonly CalibrationRunRecord[] | undefined =>
  (row as CalibratedFreeRow).calibration;
export const withCalibration = (
  rows: readonly FreeRow[],
  lookup?: (modelId: string) => readonly CalibrationRunRecord[] | undefined,
): readonly FreeRow[] => lookup === undefined ? rows : rows.map(r => ({ ...r, calibration: lookup(r.modelId) }));
export const calibrationCell = (rows: readonly CalibrationRunRecord[] | undefined): string => {
  const latest = rows?.[0];
  if (!latest) return '미검증';
  const date = latest.runAt.slice(0, 10);
  if (latest.sampleStatus !== 'stable') return `측정 부족 · 잠정 · ${latest.sampleCount}회 · ${date}`;
  if (latest.verdict === 'capable' || latest.verdict === 'assistant') {
    const head = latest.verdict === 'capable' ? '작업 가능' : '보조 가능';
    return `${head} · ${latest.totalScore}/100 · ${latest.sampleCount}회 · task-set ${latest.taskSetVersion} · ${date}`;
  }
  return '권장하지 않음';
};
export const freeMarkdownRows = (rows: readonly FreeRow[]): string[] => rows.map(row =>
  `| ${row.modelId} | ${freeCell(row.orchestrator)} | ${freeCell(row.worker)} | ${row.indexText ?? '-'} | ${pathOf(row.plans)} | ${freeNote(row)} | ${calibrationCell(calOf(row))} |`);
export const freeCompactRows = (rows: readonly FreeRow[]): string[] => rows.map(row =>
  `${row.modelId} · 오케 ${freeCell(row.orchestrator)} · 워커 ${freeCell(row.worker)} · ${pathOf(row.plans)} · ${freeNote(row)}`);
