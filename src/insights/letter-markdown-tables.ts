import type { OptimalZoneRole } from './letter-top10-worker.js';
import type { RoleEntry, RoleList, RoleLists } from './letter-top10-unified.js';
import { PARETO_MARK, ROLE_LABELS, dimensionsLabel, changeNote, exitLine, formatChange, leadText, dimensionsText, bonusText } from './letter-top10-legend.js';

/** 두 계열 공통 열(2026-10-13): 스코어 옆에 스코어에 쓰인 근거를, AA 지수는 두 역할 모두 Intelligence(p85)를 보인다. 워커만 `가산` 열이 더 있다. */
const columns = (role: OptimalZoneRole, withPareto = true): string[] => ['순위', ...(withPareto ? ['파레토'] : []),
  '모델', '추천 effort', '스코어', dimensionsLabel(role),
  ...(role === 'worker' ? ['가산'] : []), 'AA 지수', '혼합 단가', '변동'];
const tableHead = (role: OptimalZoneRole, withPareto = true): string => `| ${columns(role, withPareto).join(' | ')} |\n| ${columns(role, withPareto).map(() => '---').join(' | ')} |`;
/** #194: effort 칸은 plain(high/xhigh/default)만 — (미확인)·(상한)·벤치마크 표기를 화면에서 뺀다. */
export const effortCell = (e: RoleEntry): string => e.repEffort;

/** withPareto 기본값은 Top7 본문(rowLimit 7)에서는 빼고 Top15 댓글에서는 유지한다. 점수·데이터 불변. */
export function renderRoleTable(role: OptimalZoneRole, list: RoleList, heading: string, rowLimit = Infinity, withExits = true, withPareto = rowLimit !== 7): string {
  const rows = list.entries.slice(0, rowLimit).map(e => {
    const rank = `${e.belowZone ? '▽ ' : ''}${e.rank}`;
    const cells = [rank, ...(withPareto ? [e.isPareto ? PARETO_MARK : ''] : []), e.modelId, effortCell(e), e.scoreText ?? '-', dimensionsText(e, role),
      ...(role === 'worker' ? [bonusText(e, role)] : []), e.indexText, `${e.blendedCostText}${e.offPeak ? ' off-peak' : ''}`, formatChange(e.change)];
    return `| ${cells.join(' | ')} |`;
  });
  const exits = withExits ? list.exits.map(x => exitLine(x.modelId, x.previousRank)) : [];
  return [`${heading}\n\n${tableHead(role, withPareto)}`, ...rows, ...(exits.length ? ['', ...exits] : [])].join('\n');
}
export function summarizeLists(lists: RoleLists): string {
  const o = lists.orchestrator.entries[0], w = lists.worker.entries[0];
  const lead = o || w ? `선두: ${ROLE_LABELS.orchestrator} ${leadText(o)} · ${ROLE_LABELS.worker} ${leadText(w)}` : '선두: 자료 부족';
  return `## 요약\n- ${lead}\n- 변동: ${changeNote(ROLE_LABELS.orchestrator, lists.orchestrator)} · ${changeNote(ROLE_LABELS.worker, lists.worker)}`;
}
