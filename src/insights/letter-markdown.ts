import { computeRoleTop10, type RoleList, type RoleLists } from './letter-top10-unified.js';
import type { OptimalZoneRole } from './letter-top10-worker.js';
import type { Top10RecordInput } from './letter-top10-rank.js';
import { top10OptionsFrom } from './letter-top10-render-options.js';
import { SOURCE_LINES, SCORE_FORMULA_LINES, escapeShields, sourceStatusLines, statusBadge, truncateAtRowBoundary } from './letter-markdown-format.js';
import { EXCLUSION_NOTE } from './top10-policy.js';
import { LEGEND_LINES, PARETO_MARK, ROLE_HEADINGS, ROLE_LABELS, dimensionsLabel, ZONE_TEXT, changeNote, exitLine, formatChange, leadText, dimensionsText, bonusText } from './letter-top10-legend.js';
import { freeListsFrom, renderFreeSectionMarkdown, unmeasuredFreeEntries, type UnmeasuredFree } from './letter-markdown-free.js';
import type { PlanCatalogEntry } from './plan-catalog.js';

export { escapeShields, OMISSION_MARK, MARKDOWN_LIMIT } from './letter-markdown-format.js';
export type { RoleLists, RoleList, RoleEntry, RoleExit } from './letter-top10-unified.js';

/** 파레토 최적은 순위·모델 칸에 섞지 않고 독립 열(👍)로 둔다(2026-10-13 사용자 지시). 교집합 표시는 두지 않는다. */
/** 두 계열 공통 열(2026-10-13): 스코어 옆에 스코어에 쓰인 근거를, AA 지수는 두 역할 모두 Intelligence(p85)를 보인다. 워커만 `가산` 열이 더 있다. */
const columns = (role: OptimalZoneRole): string[] => ['순위', '파레토', '모델', '추천 effort', '스코어', dimensionsLabel(role),
  ...(role === 'worker' ? ['가산'] : []), 'AA 지수', '혼합 단가', '변동'];
const tableHead = (role: OptimalZoneRole): string => `| ${columns(role).join(' | ')} |\n| ${columns(role).map(() => '---').join(' | ')} |`;

function renderTable(role: OptimalZoneRole, list: RoleList): string {
  const rows = list.entries.map(e => {
    const rank = `${e.belowZone ? '▽ ' : ''}${e.rank}`;
    const cells = [rank, e.isPareto ? PARETO_MARK : '', e.modelId, e.repEffort, e.scoreText ?? '-', dimensionsText(e, role),
      ...(role === 'worker' ? [bonusText(e, role)] : []), e.indexText, `${e.blendedCostText}${e.offPeak ? ' off-peak' : ''}`, formatChange(e.change)];
    return `| ${cells.join(' | ')} |`;
  });
  const exits = list.exits.map(x => exitLine(x.modelId, x.previousRank));
  return [`${ROLE_HEADINGS[role]}\n\n${tableHead(role)}`, ...rows, ...(exits.length ? ['', ...exits] : [])].join('\n');
}
function summarize(lists: RoleLists): string {
  const o = lists.orchestrator.entries[0], w = lists.worker.entries[0];
  const lead = o || w ? `선두: ${ROLE_LABELS.orchestrator} ${leadText(o)} · ${ROLE_LABELS.worker} ${leadText(w)}` : '선두: 자료 부족';
  return `## 요약\n- ${lead}\n- 변동: ${changeNote(ROLE_LABELS.orchestrator, lists.orchestrator)} · ${changeNote(ROLE_LABELS.worker, lists.worker)}`;
}

export function renderTop10Markdown(data: {
  readonly publicationDate: string; readonly lists: RoleLists; readonly free?: RoleLists | undefined;
  readonly freeUnmeasured?: readonly UnmeasuredFree[];
  readonly failedSources?: readonly string[]; readonly partialSources?: readonly string[]; readonly notes?: readonly string[];
}): string {
  const failed = data.failedSources ?? [], partial = data.partialSources ?? [], notes = data.notes ?? [];
  const badges = [
    `![date](https://img.shields.io/badge/date-${escapeShields(data.publicationDate)}-blue)`,
    `![sources](https://img.shields.io/badge/sources-${escapeShields(`${SOURCE_LINES.length} total`)}-informational)`,
    statusBadge(failed, partial),
  ].join('\n');

  const formulas = [
    `- 자격: ${ZONE_TEXT} · 오케 3차원 중 하나 이상 근거(검증 Free 경로 포함)·워커 AA intel 원값 하한 통과 · 보유 요금제 접근 모델만`,
    '- 혼합 단가=(3×입력+출력)/4 USD/1M',
    ...SCORE_FORMULA_LINES,
    `- ${EXCLUSION_NOTE}`,
  ].join('\n');
  const warnings = notes.length ? `\n\n### 경고\n` + notes.map(n => `- ⚠️ ${n}`).join('\n') : '';
  const details = `<details><summary>출처 및 산출 공식</summary>\n\n### 산출 공식 및 정책\n` +
    `${formulas}\n\n### 실패 소스 안내\n${sourceStatusLines(failed, partial).join('\n')}${warnings}\n\n### 출처\n` +
    `${SOURCE_LINES.join('\n')}\n</details>`;

  const parts = [
    `# AI 인사이트 데일리: ${data.publicationDate} KST`,
    badges,
    summarize(data.lists),
    renderTable('orchestrator', data.lists.orchestrator),
    renderTable('worker', data.lists.worker),
    renderFreeSectionMarkdown(data.free, data.freeUnmeasured ?? []).join('\n'),
    LEGEND_LINES.join('\n'),
    details,
  ];
  return truncateAtRowBoundary(parts.join('\n\n'));
}

export interface MarkdownLetterInput {
  readonly publicationDate: string; readonly records: readonly Top10RecordInput[];
  readonly openrouterRecords?: readonly Top10RecordInput[];
  readonly opencodeDataRecords?: readonly Top10RecordInput[]; readonly cognitionRecords?: readonly Top10RecordInput[];
  readonly previousRanks?: readonly Top10RecordInput[]; readonly failedSources?: readonly string[];
  readonly notes?: readonly string[]; readonly partialSources?: readonly string[];
  readonly freeCatalog?: readonly PlanCatalogEntry[];
}
export function renderTop10MarkdownFromRecords(input: MarkdownLetterInput): string {
  const opts = top10OptionsFrom(input);
  const free = freeListsFrom(input.records, input.freeCatalog, opts);
  return renderTop10Markdown({
    publicationDate: input.publicationDate,
    lists: computeRoleTop10(input.records, opts),
    free,
    freeUnmeasured: unmeasuredFreeEntries(input.freeCatalog, input.records, free),
    ...(input.failedSources && { failedSources: input.failedSources }),
    ...(input.partialSources && { partialSources: input.partialSources }),
    ...(input.notes && { notes: input.notes }),
  });
}
