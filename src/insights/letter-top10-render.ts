import { computeRoleTop10, SECTION_HEADINGS, type RoleList, type RoleLists } from './letter-top10-unified.js';
import type { OptimalZoneRole } from './letter-top10-worker.js';
import { EXCLUSION_NOTE } from './top10-policy.js';
import { SCORE_FORMULA_LINES } from './letter-markdown-format.js';
import { cursorLabelFor, freeLists, freeOnlyModelIds, renderFreeSectionCompact, shortPlan } from './letter-markdown-free.js';
import { toRankedRecords, type Top10RecordInput } from './letter-top10-rank.js';
import { LEGEND_LINES, changeNote, exitLine, formatChange } from './letter-top10-legend.js';

export interface Top10LetterInput {
  readonly publicationDate: string; // YYYY-MM-DD
  readonly lists: RoleLists;
  readonly failedSources?: readonly string[]; readonly notes?: readonly string[];
  readonly partialSources?: readonly string[]; readonly free?: RoleLists;
}

const ATTRIBUTIONS = ['출처: lmarena-ai LMArena Leaderboard Dataset (CC-BY-4.0)', '출처: OpenRouter (CC-BY-4.0)',
  '출처: Artificial Analysis (라이선스 미상)', '출처: Cognition FrontierCode (라이선스 미상 · 내부 전용)',
  '출처: OpenCode Data (내부 참조 · 약관상 자동 추출 제한) (라이선스 미상)'] as const;

/** Control/bidi characters removed and credential-like fragments redacted, like the legacy renderer. */
const clean = (value: string, limit = 120): string => value
  .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
  .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, ' ')
  .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
  .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)\s*[:=]\s*[^\s&]+/gi, '[redacted]')
  .replace(/\b(?:sk-|sk_|hf_|gh[pousr]_)[A-Za-z0-9_-]{4,}/g, '[redacted]').slice(0, limit);
const NAME_LIMIT = 120, EXIT_LIMIT = 5, FAILURE_LIMIT = 3;

function section(role: OptimalZoneRole, list: RoleList): string[] {
  const lines = [SECTION_HEADINGS[role]];
  if (!list.entries.length) lines.push('자료 부족: 존을 통과한 접근 가능 모델이 없습니다.');
  for (const e of list.entries) {
    const rank = e.belowZone ? `▽ ${e.rank}` : String(e.rank);
    const refs = [e.openrouterRankText, e.arenaRankText, e.isPareto ? '⭐' : ''].filter(r => r !== undefined && r !== '' && !r.endsWith('-'));
    lines.push(`${rank}. ${clean(e.modelId, NAME_LIMIT)}${e.both ? ' ↔' : ''} · effort ${clean(e.repEffort, 12)} · 스코어 ${clean(e.scoreText ?? '-', 40)} · ${clean(e.indexText, 80)}` +
      ` · ${clean(e.blendedCostText, 40)}${e.offPeak ? ' · off-peak' : ''} · 접근 ${e.plans.map(p => shortPlan(cursorLabelFor(e.modelId, p))).join('+') || '미상'}` +
      `${refs.length ? ` · ${refs.join(' · ')}` : ''}${e.variantsText ? ` · 변형 ${clean(e.variantsText, 160)}` : ''}` +
      `${e.successorOf ? ` · AA 미수록 · 선행 지수 하한(${clean(e.successorOf, 40)})` : ''} · ${formatChange(e.change)}`);
  }
  for (const x of list.exits.slice(0, EXIT_LIMIT)) lines.push(exitLine(clean(x.modelId, NAME_LIMIT), x.previousRank));
  if (list.exits.length > EXIT_LIMIT) lines.push(`🚪 그 외 이탈 ${list.exits.length - EXIT_LIMIT}개`);
  return lines;
}
function summarize(lists: RoleLists): string[] {
  const o = lists.orchestrator.entries[0], w = lists.worker.entries[0];
  return ['## 요약',
    `- 선두: 오케스트레이터 ${o ? `${o.modelId} (${o.indexText})` : '자료 부족'} · 워커 ${w ? `${w.modelId} (${w.indexText})` : '자료 부족'}`,
    `- 변동: ${changeNote('오케스트레이터', lists.orchestrator)} · ${changeNote('워커', lists.worker)}`,
    '- 사실 기준 요약이며 추정 동향은 넣지 않습니다.'];
}
export function renderTop10Letter(data: Top10LetterInput): string {
  const lines: string[] = [
    `[AI 인사이트 데일리: ${data.publicationDate} KST (내부 전용)]`,
    '두 목록 Top10: 오케스트레이터 존(지능 ≥ 후보 최고 85%)·워커 존(코딩 ≥ 후보 최고 75%) 통과 모델, 보유 요금제 접근 가능만',
    ...summarize(data.lists),
    '',
    ...section('orchestrator', data.lists.orchestrator),
    '',
    ...section('worker', data.lists.worker),
    ...(data.free ? renderFreeSectionCompact(data.free, 2) : []),
    '',
    ...LEGEND_LINES,
    '',
    '## 출처 및 안내',
    ...ATTRIBUTIONS,
    data.failedSources && data.failedSources.length > 0
      ? `수집 실패 소스: ${data.failedSources.slice(0, FAILURE_LIMIT).map(s => clean(s, 40)).join(', ')}` +
        (data.failedSources.length > FAILURE_LIMIT ? ` 외 ${data.failedSources.length - FAILURE_LIMIT}개` : '') : '전 소스 정상 수집',
    ...(data.partialSources?.length ? [`부분 수집 소스: ${data.partialSources.slice(0, FAILURE_LIMIT).map(s => clean(s, 40)).join(', ')}`] : []),
    '혼합 단가=(3×입력+출력)/4 USD/1M',
    ...SCORE_FORMULA_LINES,
    `정렬: 스코어 내림차순(동점 시 지수) · ${EXCLUSION_NOTE}`,
    '상세 지표는 SQLite 이력에서 확인할 수 있습니다.',
    ...(data.notes ?? []).map(note => clean(note, 160)),
  ];
  let text = lines.join('\n');
  if (text.length > 3500) text = (c => c === text ? text : c.replace('상세 지표는 SQLite 이력에서 확인할 수 있습니다.', '상세 지표는 SQLite 이력에서 확인할 수 있습니다. (Free 티어 생략)'))(text.replace(/\n## 🆓 Free 티어[\s\S]*?(?=\n## )/, '')); // 예산에 가까우면 Free 섹션을 먼저 접는다(전문은 --markdown)
  if (text.length > 3600) { // 필수 필드(effort·지수·접근)를 지키기 위해 모델 이름만 줄인다(원문 저장은 유지)
    const clip = (s: string): string => [...s].length > 24 ? `${[...s].slice(0, 24).join('')}…` : s;
    text = text.replace(/^(\d+\. )([^\n]+?)( · effort )/gm, (_m, h, n, t) => `${h}${clip(n)}${t}`)
      .replace(/^(- 선두: 오케스트레이터 )([^ ]+)( · 워커 )([^ ]+)$/m, (_m, a, b, c, d) => `${a}${clip(b)}${c}${clip(d)}`);
  }
  if (text.length > 3600) { const c = text.replace(/ · 변형 [^\n]*/g, ''); if (c !== text) text = `${c}\n안내: 길이 예산으로 변형 나열을 생략했습니다.`; }
  if (text.length > 3600) { const c = text.replace(/ · (?:OpenRouter|Arena) \d+위/g, ''); if (c !== text) text = `${c}\n안내: 길이 예산으로 참고순위를 생략했습니다.`; }
  return text;
}

export interface CompactLetterInput { readonly publicationDate: string; readonly records: readonly Top10RecordInput[];
  readonly arenaRecords?: readonly Top10RecordInput[]; readonly openrouterRecords?: readonly Top10RecordInput[];
  readonly previousRanks?: readonly Top10RecordInput[]; readonly failedSources?: readonly string[]; readonly notes?: readonly string[];
  readonly partialSources?: readonly string[] }
/** Builds the compact letter from letter rows (no I/O): per-role zone policy over AA indices. */
export function renderTop10FromRecords(input: CompactLetterInput): string {
  const options = { ...(input.arenaRecords && { arenaRecords: input.arenaRecords }), ...(input.openrouterRecords && { openrouterRecords: toRankedRecords(input.openrouterRecords) }),
    ...(input.previousRanks && { previousCohort: input.previousRanks }), excludeModelIds: new Set(freeOnlyModelIds()) };
  return renderTop10Letter({ publicationDate: input.publicationDate, lists: computeRoleTop10(input.records, options), free: freeLists(input.records, options),
    ...(input.failedSources && { failedSources: input.failedSources }),
    ...(input.notes && { notes: input.notes }),
    ...(input.partialSources && { partialSources: input.partialSources }) });
}
