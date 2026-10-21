import { computeRoleTop10, type RoleList, type RoleLists } from './letter-top10-unified.js';
import type { Top10RecordInput } from './letter-top10-rank.js';
import { top10OptionsFrom } from './letter-top10-render-options.js';
import type { EffortAvailability } from './letter-effort-availability.js';
import { ARENA_REFERENCE_LINE, SOURCE_LINES, SCORE_FORMULA_LINES, escapeShields, sourceStatusLines, statusBadge, truncateAtRowBoundary } from './letter-markdown-format.js';
import { EXCLUSION_NOTE } from './top10-policy.js';
import { LEGEND_LINES, ROLE_HEADINGS_TOP15, ROLE_HEADINGS_TOP7, ZONE_TEXT } from './letter-top10-legend.js';
import { freeListsFrom, renderFreeSectionMarkdown, unmeasuredFreeEntries, type UnmeasuredFree } from './letter-markdown-free.js';
import type { FreeReviewerEntry } from './letter-markdown-free-sort.js';
import { renderRoleTable, summarizeLists } from './letter-markdown-tables.js';
import { joinLetterParts, type LetterComments, type LetterParts } from './letter-parts.js';
import type { PlanCatalogEntry } from './plan-catalog.js';

export { escapeShields, OMISSION_MARK, MARKDOWN_LIMIT } from './letter-markdown-format.js';
export type { RoleLists, RoleList, RoleEntry, RoleExit } from './letter-top10-unified.js';
export { joinLetterParts, type LetterParts } from './letter-parts.js';


export interface MarkdownLetterData {
  readonly publicationDate: string; readonly lists: RoleLists; readonly free?: RoleLists | undefined;
  readonly freeUnmeasured?: readonly UnmeasuredFree[];
  readonly freeReviewer?: readonly FreeReviewerEntry[];
  readonly failedSources?: readonly string[]; readonly partialSources?: readonly string[]; readonly notes?: readonly string[];
}
/** 본문 Top7 + 댓글 Top15·Top15·Free 분리. 본문 요약·변동은 Top7 기준, 퇴장은 댓글에만 둔다. */
export function renderLetterParts(data: MarkdownLetterData): LetterParts {
  const failed = data.failedSources ?? [], partial = data.partialSources ?? [], notes = data.notes ?? [];
  const badges = [
    `![date](https://img.shields.io/badge/date-${escapeShields(data.publicationDate)}-blue)`,
    `![sources](https://img.shields.io/badge/sources-${escapeShields(`${SOURCE_LINES.length} total`)}-informational)`,
    statusBadge(failed, partial),
  ].join('\n');

  const formulas = [
    `- 자격: ${ZONE_TEXT} · 네 차원 중 하나 이상 근거(검증 Free 경로 포함)·워커 AA intel 원값 하한 통과 · 보유 요금제 접근 모델만`,
    '- 혼합 단가=(3×입력+출력)/4 USD/1M',
    ...SCORE_FORMULA_LINES,
    `- ${EXCLUSION_NOTE}`,
  ].join('\n');
  const warnings = notes.length ? `\n\n### 경고\n` + notes.map(n => `- ⚠️ ${n}`).join('\n') : '';
  const details = `<details><summary>출처 및 산출 공식</summary>\n\n### 산출 공식 및 정책\n` +
    `${formulas}\n\n### 실패 소스 안내\n${sourceStatusLines(failed, partial).join('\n')}${warnings}\n\n### 출처\n` +
    `${SOURCE_LINES.join('\n')}\n\n### 참고\n${ARENA_REFERENCE_LINE}\n</details>`;

  const top7 = (list: RoleList): RoleList => ({ entries: list.entries.slice(0, 7), exits: [] });
  const bodyLists: RoleLists = { orchestrator: top7(data.lists.orchestrator), worker: top7(data.lists.worker) };
  const body = truncateAtRowBoundary([
    `# AI 인사이트 데일리: ${data.publicationDate} KST`,
    badges,
    summarizeLists(bodyLists),
    renderRoleTable('orchestrator', bodyLists.orchestrator, ROLE_HEADINGS_TOP7.orchestrator, 7, false),
    renderRoleTable('worker', bodyLists.worker, ROLE_HEADINGS_TOP7.worker, 7, false),
    LEGEND_LINES.join('\n'),
    details,
  ].join('\n\n'));
  const [commentOke, commentWorker, commentFree] = ([
    renderRoleTable('orchestrator', data.lists.orchestrator, ROLE_HEADINGS_TOP15.orchestrator),
    renderRoleTable('worker', data.lists.worker, ROLE_HEADINGS_TOP15.worker),
    renderFreeSectionMarkdown(data.free, data.freeUnmeasured ?? [], undefined, undefined, data.freeReviewer).join('\n'),
  ]).map(part => truncateAtRowBoundary(part));
  const comments: LetterComments = [commentOke!, commentWorker!, commentFree!];
  // U3b: Free 섹션을 별도 노출해 3/4역할 조립이 마지막 댓글에 붙일 수 있게 한다(2역할 comments[2] 는 동일 문자열).
  return { body, comments, freeSection: commentFree! };
}

export function renderTop10Markdown(data: MarkdownLetterData): string { return joinLetterParts(renderLetterParts(data)); }

export interface MarkdownLetterInput {
  readonly publicationDate: string; readonly records: readonly Top10RecordInput[];
  readonly openrouterRecords?: readonly Top10RecordInput[];
  readonly opencodeDataRecords?: readonly Top10RecordInput[]; readonly cognitionRecords?: readonly Top10RecordInput[];
  readonly previousRanks?: readonly Top10RecordInput[]; readonly failedSources?: readonly string[];
  readonly notes?: readonly string[]; readonly partialSources?: readonly string[];
  readonly catalog?: readonly PlanCatalogEntry[]; readonly freeCatalog?: readonly PlanCatalogEntry[];
  readonly freeReviewer?: readonly FreeReviewerEntry[];
  /** #188: run-once 가용성 스냅샷(없으면 computeRoleTop10이 env 게이트로 기본 해석). */
  readonly effortAvailability?: EffortAvailability;
}
export function renderLetterPartsFromRecords(input: MarkdownLetterInput): LetterParts {
  const opts = top10OptionsFrom(input);
  const free = freeListsFrom(input.records, input.freeCatalog, opts);
  return renderLetterParts({
    publicationDate: input.publicationDate,
    lists: computeRoleTop10(input.records, opts),
    free,
    freeUnmeasured: unmeasuredFreeEntries(input.freeCatalog, input.records, free),
    ...(input.freeReviewer !== undefined && { freeReviewer: input.freeReviewer }),
    ...(input.failedSources && { failedSources: input.failedSources }),
    ...(input.partialSources && { partialSources: input.partialSources }),
    ...(input.notes && { notes: input.notes }),
  });
}
export function renderTop10MarkdownFromRecords(input: MarkdownLetterInput): string {
  return joinLetterParts(renderLetterPartsFromRecords(input));
}
