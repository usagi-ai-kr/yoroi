import { computeOrchestratorTop10, computeWorkerTop10, type Top10Result } from './letter-top10-rank.js';
import type { Top10LetterInput, CompactLetterInput } from './letter-top10-render.js';
import { renderPlanOptimalMarkdown } from './letter-markdown-plan.js';
import { SOURCE_LINES, escapeShields, sourceStatusLines, statusBadge, truncateAtRowBoundary } from './letter-markdown-format.js';
import { EXCLUSION_NOTE } from './top10-policy.js';

export { escapeShields, OMISSION_MARK, MARKDOWN_LIMIT } from './letter-markdown-format.js';
export { type Top10LetterInput, type CompactLetterInput };

const fmtChg = (c: string): string =>
  c === '신규' ? '🆕 신규' : c.startsWith('▲') ? `🔼 ${c.slice(1)}` : c.startsWith('▼') ? `🔽 ${c.slice(1)}` : c;

function renderTable(title: string, result: Top10Result): string {
  const head = `## ${title}\n\n| 순위 | 모델 | 추천 effort | 지수 | 혼합 단가 | 가성비 | OR 사용량 | 변동 |\n| --- | --- | --- | --- | --- | --- | --- | --- |`;
  const rows = result.entries.map(e => {
    const rank = e.isPareto ? `⭐ ${e.rank}` : String(e.rank);
    return `| ${rank} | ${e.modelId} | ${e.repEffort} | ${e.indexValue} | ${e.blendedCostText} | ${e.costEffRankText} | ${e.openrouterRankText} | ${fmtChg(e.change)} |`;
  });
  const exits = result.exits.map(x => `• 이탈: ${x.modelId} (전일 ${x.previousRank}위)`);
  return [head, ...rows, ...(exits.length ? ['', ...exits] : [])].join('\n');
}

function summarize(data: Top10LetterInput): string {
  const leader = data.orchestrator.entries[0] ?? data.worker.entries[0];
  const lead = leader ? `선두: ${leader.modelId} (${leader.indexValue})` : '선두: 자료 부족';
  const all = [...data.orchestrator.entries, ...data.worker.entries];
  const changed = all.filter(e => e.change !== '유지' && e.change !== '신규').length;
  const newCount = all.filter(e => e.change === '신규').length;
  const exits = data.orchestrator.exits.length + data.worker.exits.length;
  const note = all.length === 0 ? '자료 부족' : all.every(e => e.change === '신규') ? '첫 집계: 전일 비교 기록 없음'
    : `상위권 ${all.length}개 중 ${changed}개 변동${newCount ? ` (신규 ${newCount}개)` : ''}, 이탈 ${exits}개`;
  return `## 요약\n- ${lead}\n- 변동: ${note}`;
}

export function renderTop10Markdown(data: Top10LetterInput, planSection?: readonly string[]): string {
  const failed = data.failedSources ?? [], partial = data.partialSources ?? [], notes = data.notes ?? [];
  const badges = [
    `![date](https://img.shields.io/badge/date-${escapeShields(data.publicationDate)}-blue)`,
    `![sources](https://img.shields.io/badge/sources-${escapeShields(`${SOURCE_LINES.length} total`)}-informational)`,
    statusBadge(failed, partial),
  ].join('\n');

  const formulas = [
    '- 가성비 최적 존: 지수 ≥ 최고의 85%(오케스트레이터)/75%(워커) 중 가성비 순 · ★ 파레토 최적',
    '- 혼합 단가=(3×입력+출력)/4 USD/1M · 가성비=지수÷max(단가,0.01)',
    '- 정렬: 가성비 순(무료 최상위) → OpenRouter 사용량 → 속도 → 지수, 단가 미상 후순위',
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
    summarize(data),
    renderTable('🧭 오케스트레이터 Top10 (판단·계획 / Intelligence Index)', data.orchestrator),
    renderTable('🛠️ 워커 Top10 (실행·코딩 / Coding Index)', data.worker),
    ...(planSection?.length ? [planSection.join('\n')] : []),
    details,
  ];
  return truncateAtRowBoundary(parts.join('\n\n'));
}

export function renderTop10MarkdownFromRecords(input: CompactLetterInput): string {
  const opts = {
    ...(input.arenaRecords && { arenaRecords: input.arenaRecords }),
    ...(input.openrouterRecords && { openrouterRecords: input.openrouterRecords }),
    ...(input.previousRanks && { previousCohort: input.previousRanks }),
  };
  return renderTop10Markdown({
    publicationDate: input.publicationDate,
    orchestrator: computeOrchestratorTop10(input.records, opts),
    worker: computeWorkerTop10(input.records, opts),
    ...(input.failedSources && { failedSources: input.failedSources }),
    ...(input.partialSources && { partialSources: input.partialSources }),
    ...(input.notes && { notes: input.notes }),
  }, renderPlanOptimalMarkdown(input.records));
}
