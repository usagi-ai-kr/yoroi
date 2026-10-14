import { PARETO_MARK } from './letter-top10-legend.js';
import type { FreeCell, FreeRow } from './letter-markdown-free-sort.js';

/** p75 B: Free 경로 칸(알려진 free 플랜명 + 공식 근거 주의)과 한 표 렌더. */
const PATH: Readonly<Record<string, string>> = {
  'OpenCode Zen Free': 'OpenCode Zen Free',
  'OpenCode Go Free': 'OpenCode Go Free ⚠️세션 헤더 필요',
};
export const pathOf = (plans: readonly string[]): string => plans.map(plan => PATH[plan] ?? plan).join('+');
export const FREE_TABLE_HEADER = '| 모델 | 오케 | 워커 | Free 경로 | 비고 |\n| --- | --- | --- | --- | --- |';
/** 영역 칸: 자격 통과 `✓ 스코어`, 근거는 있고 미달 `✗`, 근거 없음 `-`. */
export const freeCell = (cell?: FreeCell): string => cell === undefined ? '-' : cell.passed ? `✓ ${cell.score}` : '✗';
/** 비고: 파레토·effort, 미측정은 '근거 없음'. */
export const freeNote = (row: FreeRow): string => row.unmeasured ? '근거 없음'
  : [row.pareto ? `${PARETO_MARK} 파레토` : '', row.effort ? `effort ${row.effort}` : ''].filter(Boolean).join(' · ') || '-';
export const freeMarkdownRows = (rows: readonly FreeRow[]): string[] => rows.map(row =>
  `| ${row.modelId} | ${freeCell(row.orchestrator)} | ${freeCell(row.worker)} | ${pathOf(row.plans)} | ${freeNote(row)} |`);
export const freeCompactRows = (rows: readonly FreeRow[]): string[] => rows.map(row =>
  `${row.modelId} · 오케 ${freeCell(row.orchestrator)} · 워커 ${freeCell(row.worker)} · ${pathOf(row.plans)} · ${freeNote(row)}`);
