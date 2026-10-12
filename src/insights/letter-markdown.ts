import { computeUnifiedTop10, type UnifiedResult } from './letter-top10-unified.js';
import type { Top10RecordInput } from './letter-top10-rank.js';
import { renderPlanOptimalMarkdown } from './letter-markdown-plan.js';
import { SOURCE_LINES, escapeShields, sourceStatusLines, statusBadge, truncateAtRowBoundary } from './letter-markdown-format.js';
import { EXCLUSION_NOTE } from './top10-policy.js';

export { escapeShields, OMISSION_MARK, MARKDOWN_LIMIT } from './letter-markdown-format.js';
export type { UnifiedResult, UnifiedEntry, UnifiedExit } from './letter-top10-unified.js';

const fmtChg = (c: string): string =>
  c === '신규' ? '🆕 신규' : c.startsWith('▲') ? `🔼 ${c.slice(1)}` : c.startsWith('▼') ? `🔽 ${c.slice(1)}` : c;

function renderTable(result: UnifiedResult): string {
  const head = `## 🏆 통합 Top10 (추천 역할 · 지수 · 가성비)\n\n| 순위 | 모델 | 추천 역할 | 추천 effort | 지수(역할별) | 혼합 단가 | 가성비 | 접근 요금제 | 변동 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |`;
  const rows = result.entries.map(e => {
    const rank = e.isPareto ? `⭐ ${e.rank}` : String(e.rank);
    const successor = e.successorOf ? ` (${e.successorOf} 선행)` : '';
    return `| ${rank} | ${e.modelId}${successor} | ${e.roleLabel} | ${e.repEffort} | ${e.indexText} | ${e.blendedCostText} | ${e.costEffRankText} | ${e.plans.join('+')} | ${fmtChg(e.change)} |`;
  });
  const exits = result.exits.map(x => `• 이탈: ${x.modelId} (전일 ${x.previousRank}위)`);
  return [head, ...rows, ...(exits.length ? ['', ...exits] : [])].join('\n');
}

function summarize(result: UnifiedResult): string {
  const leader = result.entries[0];
  const lead = leader ? `선두: ${leader.modelId} (${leader.indexText})` : '선두: 자료 부족';
  const all = result.entries;
  const changed = all.filter(e => e.change !== '유지' && e.change !== '신규').length;
  const newCount = all.filter(e => e.change === '신규').length;
  const exits = result.exits.length;
  const note = all.length === 0 ? '자료 부족' : all.every(e => e.change === '신규') ? '첫 집계: 전일 비교 기록 없음'
    : `상위권 ${all.length}개 중 ${changed}개 변동${newCount ? ` (신규 ${newCount}개)` : ''}, 이탈 ${exits}개`;
  return `## 요약\n- ${lead}\n- 변동: ${note}`;
}

export function renderTop10Markdown(data: {
  readonly publicationDate: string; readonly unified: UnifiedResult;
  readonly failedSources?: readonly string[]; readonly partialSources?: readonly string[]; readonly notes?: readonly string[];
}, planSection?: readonly string[]): string {
  const failed = data.failedSources ?? [], partial = data.partialSources ?? [], notes = data.notes ?? [];
  const badges = [
    `![date](https://img.shields.io/badge/date-${escapeShields(data.publicationDate)}-blue)`,
    `![sources](https://img.shields.io/badge/sources-${escapeShields(`${SOURCE_LINES.length} total`)}-informational)`,
    statusBadge(failed, partial),
  ].join('\n');

  const formulas = [
    '- 통합 Top10: 오케스트레이터 존(지능 ≥ 후보 최고 85%)·워커 존(코딩 ≥ 후보 최고 75%) 통과 + 보유 요금제 접근 가능 모델만',
    '- 가성비 최적 존: 지수 ≥ 최고의 85%(오케스트레이터)/75%(워커) 중 가성비 순 · ★ 파레토 최적',
    '- 혼합 단가=(3×입력+출력)/4 USD/1M · 가성비=지수÷max(단가,0.01)',
    '- 정렬: 가성비 중 큰 값 → OR 사용량 → 속도 → 지수, 단가 미상 후순위',
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
    summarize(data.unified),
    renderTable(data.unified),
    ...(planSection?.length ? [planSection.join('\n')] : []),
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
    ...(input.openrouterRecords && { openrouterRecords: input.openrouterRecords }),
    ...(input.previousRanks && { previousCohort: input.previousRanks }),
  };
  return renderTop10Markdown({
    publicationDate: input.publicationDate,
    unified: computeUnifiedTop10(input.records, opts),
    ...(input.failedSources && { failedSources: input.failedSources }),
    ...(input.partialSources && { partialSources: input.partialSources }),
    ...(input.notes && { notes: input.notes }),
  }, renderPlanOptimalMarkdown(input.records));
}
