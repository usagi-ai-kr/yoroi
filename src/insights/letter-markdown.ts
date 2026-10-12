import { computeRoleTop10, SECTION_HEADINGS, type RoleList, type RoleLists } from './letter-top10-unified.js';
import type { OptimalZoneRole } from './letter-top10-worker.js';
import { toRankedRecords, type Top10RecordInput } from './letter-top10-rank.js';
import { SOURCE_LINES, SCORE_FORMULA_LINES, escapeShields, sourceStatusLines, statusBadge, truncateAtRowBoundary } from './letter-markdown-format.js';
import { EXCLUSION_NOTE } from './top10-policy.js';

export { escapeShields, OMISSION_MARK, MARKDOWN_LIMIT } from './letter-markdown-format.js';
export type { RoleLists, RoleList, RoleEntry, RoleExit } from './letter-top10-unified.js';

const fmtChg = (c: string): string =>
  c === '신규' ? '🆕 신규' : c.startsWith('▲') ? `🔼 ${c.slice(1)}` : c.startsWith('▼') ? `🔽 ${c.slice(1)}` : c;
const TABLE_HEAD = '| 순위 | 모델 | 추천 effort | 스코어 | 지수 | 혼합 단가 | 접근 요금제 | 변동 |\n| --- | --- | --- | --- | --- | --- | --- | --- |';

function renderTable(role: OptimalZoneRole, list: RoleList): string {
  const rows = list.entries.map(e => {
    const rank = e.isPareto ? `⭐ ${e.rank}` : String(e.rank);
    const successor = e.successorOf ? ` (${e.successorOf} 선행)` : '';
    return `| ${rank} | ${e.modelId}${successor}${e.both ? ' ↔' : ''} | ${e.repEffort} | ${e.scoreText ?? '-'} | ` +
      `${e.indexText} | ${e.blendedCostText} | ${e.plans.join('+')} | ${fmtChg(e.change)} |`;
  });
  const exits = list.exits.map(x => `• 이탈: ${x.modelId} (전일 ${x.previousRank}위)`);
  return [`${SECTION_HEADINGS[role]}\n\n${TABLE_HEAD}`, ...rows, ...(exits.length ? ['', ...exits] : [])].join('\n');
}
const changeNote = (label: string, list: RoleList): string => {
  const all = list.entries;
  const changed = all.filter(e => e.change !== '유지' && e.change !== '신규').length;
  const newCount = all.filter(e => e.change === '신규').length;
  if (!all.length) return `${label} 자료 부족`;
  if (all.every(e => e.change === '신규')) return `${label} 첫 집계: 전일 비교 기록 없음`;
  return `${label} 상위권 ${all.length}개 중 ${changed}개 변동${newCount ? ` (신규 ${newCount}개)` : ''}, 이탈 ${list.exits.length}개`;
};
function summarize(lists: RoleLists): string {
  const o = lists.orchestrator.entries[0], w = lists.worker.entries[0];
  const lead = o || w ? `선두: 오케스트레이터 ${o ? `${o.modelId} (${o.indexText})` : '자료 부족'} · 워커 ${w ? `${w.modelId} (${w.indexText})` : '자료 부족'}`
    : '선두: 자료 부족';
  return `## 요약\n- ${lead}\n- 변동: ${changeNote('오케스트레이터', lists.orchestrator)} · ${changeNote('워커', lists.worker)}`;
}

export function renderTop10Markdown(data: {
  readonly publicationDate: string; readonly lists: RoleLists;
  readonly failedSources?: readonly string[]; readonly partialSources?: readonly string[]; readonly notes?: readonly string[];
}): string {
  const failed = data.failedSources ?? [], partial = data.partialSources ?? [], notes = data.notes ?? [];
  const badges = [
    `![date](https://img.shields.io/badge/date-${escapeShields(data.publicationDate)}-blue)`,
    `![sources](https://img.shields.io/badge/sources-${escapeShields(`${SOURCE_LINES.length} total`)}-informational)`,
    statusBadge(failed, partial),
  ].join('\n');

  const formulas = [
    '- 자격: 오케스트레이터 지능 ≥ 후보 최고 85% · 워커 코딩 ≥ 후보 최고 75% · 보유 요금제 접근 모델만',
    '- 교집합: 두 목록에 모두 오르는 모델은 모델 칸에 ↔ 표시',
    '- 혼합 단가=(3×입력+출력)/4 USD/1M',
    ...SCORE_FORMULA_LINES,
    `- ${EXCLUSION_NOTE}`,
    '- ★ 파레토 최적: 더 싸고 더 좋은 모델이 없는 상태',
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
    details,
  ];
  return truncateAtRowBoundary(parts.join('\n\n'));
}

export interface MarkdownLetterInput {
  readonly publicationDate: string; readonly records: readonly Top10RecordInput[];
  readonly arenaRecords?: readonly Top10RecordInput[]; readonly openrouterRecords?: readonly Top10RecordInput[];
  readonly previousRanks?: readonly Top10RecordInput[]; readonly failedSources?: readonly string[];
  readonly notes?: readonly string[]; readonly partialSources?: readonly string[];
}
export function renderTop10MarkdownFromRecords(input: MarkdownLetterInput): string {
  const opts = {
    ...(input.arenaRecords && { arenaRecords: input.arenaRecords }),
    ...(input.openrouterRecords && { openrouterRecords: toRankedRecords(input.openrouterRecords) }),
    ...(input.previousRanks && { previousCohort: input.previousRanks }),
  };
  return renderTop10Markdown({
    publicationDate: input.publicationDate,
    lists: computeRoleTop10(input.records, opts),
    ...(input.failedSources && { failedSources: input.failedSources }),
    ...(input.partialSources && { partialSources: input.partialSources }),
    ...(input.notes && { notes: input.notes }),
  });
}
