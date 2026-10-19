import type { OptimalZoneRole } from './letter-top10-worker.js';
import type { RoleEntry, RoleList, RoleLists } from './letter-top10-unified.js';
import { PARETO_MARK, ROLE_LABELS, dimensionsLabel, changeNote, exitLine, formatChange, leadText, dimensionsText, bonusText } from './letter-top10-legend.js';

/** 두 계열 공통 열(2026-10-13): 스코어 옆에 스코어에 쓰인 근거를, AA 지수는 두 역할 모두 Intelligence(p85)를 보인다. 워커만 `가산` 열이 더 있다. */
const columns = (role: OptimalZoneRole): string[] => ['순위', '파레토', '모델', '추천 effort', '스코어', dimensionsLabel(role),
  ...(role === 'worker' ? ['가산'] : []), 'AA 지수', '혼합 단가', '변동'];
const tableHead = (role: OptimalZoneRole): string => `| ${columns(role).join(' | ')} |\n| ${columns(role).map(() => '---').join(' | ')} |`;
/** #188 추천 effort 표기: (상한)=환경 관측 상한 적용, (미확인)=가용성 미검증(벤치마크 이론값, 선택 가능 보장 없음).
 *  Top7·Top15·compact·Free가 같은 규칙을 쓴다. */
export const effortCell = (e: RoleEntry): string => {
  const base = (e.effortAvailability ?? 'unlisted') === 'capped' ? `${e.repEffort}(상한)` : `${e.repEffort}(미확인)`;
  return e.benchmarkEffort ? `${base}·벤치마크 ${e.benchmarkEffort}` : base;
};
export const effortNote = (list: RoleList): string => list.entries.some(e => effortCell(e) !== e.repEffort)
  ? 'effort 표기: (상한)=관측 상한 적용, (미확인)=가용성 미검증·벤치마크 이론값(선택 가능 보장 없음)' : '';

export function renderRoleTable(role: OptimalZoneRole, list: RoleList, heading: string, rowLimit = Infinity, withExits = true): string {
  const rows = list.entries.slice(0, rowLimit).map(e => {
    const rank = `${e.belowZone ? '▽ ' : ''}${e.rank}`;
    const cells = [rank, e.isPareto ? PARETO_MARK : '', e.modelId, effortCell(e), e.scoreText ?? '-', dimensionsText(e, role),
      ...(role === 'worker' ? [bonusText(e, role)] : []), e.indexText, `${e.blendedCostText}${e.offPeak ? ' off-peak' : ''}`, formatChange(e.change)];
    return `| ${cells.join(' | ')} |`;
  });
  const exits = withExits ? list.exits.map(x => exitLine(x.modelId, x.previousRank)) : [], note = effortNote(list);
  return [`${heading}\n\n${tableHead(role)}`, ...rows, ...(exits.length ? ['', ...exits] : []), ...(note ? ['', `> ${note}`] : [])].join('\n');
}
export function summarizeLists(lists: RoleLists): string {
  const o = lists.orchestrator.entries[0], w = lists.worker.entries[0];
  const lead = o || w ? `선두: ${ROLE_LABELS.orchestrator} ${leadText(o)} · ${ROLE_LABELS.worker} ${leadText(w)}` : '선두: 자료 부족';
  return `## 요약\n- ${lead}\n- 변동: ${changeNote(ROLE_LABELS.orchestrator, lists.orchestrator)} · ${changeNote(ROLE_LABELS.worker, lists.worker)}`;
}
