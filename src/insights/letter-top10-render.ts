import { computeOrchestratorTop10, computeWorkerTop10, type Top10RecordInput, type Top10Result } from './letter-top10-rank.js';
import { renderPlanOptimalLines } from './plan-optimal.js';
import { SOURCE_ATTRIBUTIONS } from './source-attribution.js';
import { EXCLUSION_NOTE } from './top10-policy.js';

export interface Top10LetterInput {
  readonly publicationDate: string; // YYYY-MM-DD
  readonly orchestrator: Top10Result;
  readonly worker: Top10Result;
  readonly failedSources?: readonly string[];
  readonly notes?: readonly string[]; readonly planOptimal?: readonly string[]; readonly partialSources?: readonly string[];
}

const ATTRIBUTIONS = SOURCE_ATTRIBUTIONS;

/** Control/bidi characters removed and credential-like fragments redacted, like the legacy renderer. */
const clean = (value: string, limit = 120): string => value
  .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
  .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, ' ')
  .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
  .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)\s*[:=]\s*[^\s&]+/gi, '[redacted]')
  .replace(/\b(?:sk-|sk_|hf_|gh[pousr]_)[A-Za-z0-9_-]{4,}/g, '[redacted]').slice(0, limit);
const NAME_LIMIT = 120, EXIT_LIMIT = 5, FAILURE_LIMIT = 3;
function renderSection(title: string, result: Top10Result): string[] {
  const lines: string[] = [`## ${title}`];
  if (!result.entries.length) lines.push('자료 부족: 측정된 상위 지표가 없습니다.');
  for (const e of result.entries) {
    const refs = [e.openrouterRankText, e.arenaRankText, e.change, e.isPareto ? '★' : '']
      .filter(r => r !== '' && !r.endsWith('-')).map(r => clean(r, 40));
    const effort = e.repEffort === 'default' ? '' : ` · effort ${clean(e.repEffort, 12)}`;
    lines.push(`${e.rank}. ${clean(e.modelId, NAME_LIMIT)}${effort} · ${clean(e.costText, 80)}` +
      `${refs.length ? ` · ${refs.join(' · ')}` : ''}${e.variantsText ? ` · 변형 ${clean(e.variantsText, 160)}` : ''}`);
  }
  for (const x of result.exits.slice(0, EXIT_LIMIT))
    lines.push(`• 이탈: ${clean(x.modelId, NAME_LIMIT)} (전일 ${x.previousRank}위)`);
  if (result.exits.length > EXIT_LIMIT) lines.push(`• 그 외 이탈 ${result.exits.length - EXIT_LIMIT}개`);
  return lines;
}
function summarize(orchestrator: Top10Result, worker: Top10Result): string[] {
  const leader = orchestrator.entries[0] ?? worker.entries[0];
  const lead = leader ? `선두: ${clean(leader.modelId, NAME_LIMIT)} (${clean(leader.indexValue, 16)})` : '선두: 자료 부족';
  const items = [...orchestrator.entries, ...worker.entries], exits = orchestrator.exits.length + worker.exits.length;
  const changed = items.filter(e => e.change !== '유지' && e.change !== '신규').length;
  const newCount = items.filter(e => e.change === '신규').length;
  const newSuffix = newCount > 0 ? ` (신규 ${newCount}개)` : '';
  const note = items.length === 0 ? '자료 부족: 두 Top10 모두 측정값이 없습니다.'
    : items.every(e => e.change === '신규') ? '변동: 첫 집계: 전일 비교 기록 없음'
    : `변동: 상위권 ${items.length}개 중 ${changed}개 순위·진입 변동${newSuffix}, 이탈 ${exits}개`;
  return ['## 요약', `- ${lead}`, `- ${note}`, '- 사실 기준 요약이며 추정 동향은 넣지 않습니다.'];
}
export function renderTop10Letter(data: Top10LetterInput): string {
  const lines: string[] = [
    `[AI 인사이트 데일리: ${data.publicationDate} KST (내부 전용)]`,
    '가성비 최적 존: 지수 ≥ 최고의 85%(오케스트레이터)/75%(워커) 중 가성비 순 · ★ 파레토 최적',
    ...summarize(data.orchestrator, data.worker),
    '', ...renderSection('오케스트레이터 Top10 (판단·계획 / Intelligence Index)', data.orchestrator),
    '', ...renderSection('워커 Top10 (실행·코딩 / Coding Index)', data.worker),
    ...(data.planOptimal?.length ? ['', ...data.planOptimal] : ['']),
    '## 출처 및 안내',
    ...ATTRIBUTIONS,
    ...(data.failedSources?.length ? [`수집 실패 소스: ${data.failedSources.slice(0, FAILURE_LIMIT).map(s => clean(s, 40)).join(', ')}` +
      (data.failedSources.length > FAILURE_LIMIT ? ` 외 ${data.failedSources.length - FAILURE_LIMIT}개` : '')] : []),
    ...(data.partialSources?.length ? [`부분 수집 소스: ${data.partialSources.slice(0, FAILURE_LIMIT).map(s => clean(s, 40)).join(', ')}`] : []),
    ...(!data.failedSources?.length && !data.partialSources?.length ? ['전 소스 정상 수집'] : []),
    '혼합 단가=(3×입력+출력)/4 USD/1M · 가성비=지수÷max(단가,0.01)',
    '정렬: 가성비 순(무료 최상위) → OpenRouter 사용량 → 지수, 단가 미상 후순위 · ★ 파레토 최적은 더 싸고 더 좋은 모델이 없는 상태',
    EXCLUSION_NOTE,
    '상세 지표는 SQLite 이력에서 확인할 수 있습니다.',
    ...(data.notes ?? []).map(note => clean(note, 160)),
  ];
  let text = lines.join('\n');
  if (text.length > 3000) { // 필수 필드(effort/변형/OR순위)를 지키기 위해 이름을 먼저 줄인다(원문 저장은 유지)
    text = text.replace(/^(\d+\. )([^\n]{70,}?)( · )/gm, (_m, head, name, tail) => `${head}${name.slice(0, 24)}…${tail}`)
      .replace(/^(- 선두: )([^\n]{70,})$/m, (_m, head, name) => `${head}${name.slice(0, 24)}…`);
  }
  if (text.length > 3000) { text = text.replace(/ · 변형 [^\n]*/g, ''); text += '\n안내: 길이 예산으로 변형 나열을 생략했습니다.'; }
  if (text.length > 3000) { text = text.replace(/ · (?:OpenRouter|Arena) \d+위/g, ''); text += '\n안내: 길이 예산으로 참고순위를 생략했습니다.'; }
  return text;
}

export interface CompactLetterInput { readonly publicationDate: string; readonly records: readonly Top10RecordInput[];
  readonly arenaRecords?: readonly Top10RecordInput[]; readonly openrouterRecords?: readonly Top10RecordInput[];
  readonly previousRanks?: readonly Top10RecordInput[]; readonly failedSources?: readonly string[]; readonly notes?: readonly string[];
  readonly partialSources?: readonly string[]; readonly nowUtc?: string; readonly observedAt?: string }
/** Builds the compact letter from letter rows (no I/O): AA intelligence orchestrator + coding worker,
 * Arena/OpenRouter reference ranks only when they are exact, previous ranks only when stored. */
export function renderTop10FromRecords(input: CompactLetterInput): string {
  const nowUtc = input.nowUtc ?? input.observedAt;
  const options = { ...(input.arenaRecords && { arenaRecords: input.arenaRecords }), ...(input.openrouterRecords && { openrouterRecords: input.openrouterRecords }),
    ...(input.previousRanks && { previousCohort: input.previousRanks }), ...(nowUtc && { nowUtc }) };
  const planOptimal = renderPlanOptimalLines(input.records, undefined, nowUtc);
  return renderTop10Letter({ publicationDate: input.publicationDate, orchestrator: computeOrchestratorTop10(input.records, options),
    worker: computeWorkerTop10(input.records, options), ...(input.failedSources && { failedSources: input.failedSources }),
    ...(input.notes && { notes: input.notes }), ...(planOptimal.length && { planOptimal }),
    ...(input.partialSources && { partialSources: input.partialSources }) });
}
