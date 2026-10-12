import { computeUnifiedTop10, type UnifiedResult } from './letter-top10-unified.js';
import { renderPlanOptimalLines } from './plan-optimal.js';
import { EXCLUSION_NOTE } from './top10-policy.js';
import type { Top10RecordInput } from './letter-top10-rank.js';

export interface Top10LetterInput {
  readonly publicationDate: string; // YYYY-MM-DD
  readonly unified: UnifiedResult;
  readonly failedSources?: readonly string[];
  readonly notes?: readonly string[]; readonly planOptimal?: readonly string[]; readonly partialSources?: readonly string[];
}

const ATTRIBUTIONS = [
  '출처: lmarena-ai LMArena Leaderboard Dataset (CC-BY-4.0)',
  '출처: OpenRouter (CC-BY-4.0)',
  '출처: Artificial Analysis (라이선스 미상)',
  '출처: Cognition FrontierCode (라이선스 미상 · 내부 전용)',
  '출처: OpenCode Data (내부 참조 · 약관상 자동 추출 제한) (라이선스 미상)',
] as const;

/** Control/bidi characters removed and credential-like fragments redacted, like the legacy renderer. */
const clean = (value: string, limit = 120): string => value
  .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
  .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, ' ')
  .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
  .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)\s*[:=]\s*[^\s&]+/gi, '[redacted]')
  .replace(/\b(?:sk-|sk_|hf_|gh[pousr]_)[A-Za-z0-9_-]{4,}/g, '[redacted]').slice(0, limit);
const NAME_LIMIT = 120, EXIT_LIMIT = 5, FAILURE_LIMIT = 3;
const fmtChg = (c: string): string => c === '신규' ? '🆕 신규' : c.startsWith('▲') ? `🔼 ${c.slice(1)}` : c.startsWith('▼') ? `🔽 ${c.slice(1)}` : c;

function renderSection(result: UnifiedResult): string[] {
  const lines = ['## 🏆 통합 Top10 (추천 역할 · 지수 · 가성비)'];
  if (!result.entries.length) lines.push('자료 부족: 존을 통과한 접근 가능 모델이 없습니다.');
  for (const e of result.entries) {
    const refs = [e.openrouterRankText, e.arenaRankText, e.isPareto ? '★' : ''].filter(r => r !== undefined && r !== '' && !r.endsWith('-'));
    lines.push(`${e.rank}. ${clean(e.modelId, NAME_LIMIT)} · ${e.roleLabel} · effort ${clean(e.repEffort, 12)} · ${clean(e.indexText, 80)}` +
      ` · ${clean(e.blendedCostText, 40)}${e.offPeak ? ' · off-peak' : ''} · ${clean(e.costEffRankText, 40)} · 접근 ${e.plans.map(p => clean(p, 40)).join('+') || '미상'}` +
      `${refs.length ? ` · ${refs.join(' · ')}` : ''}${e.variantsText ? ` · 변형 ${clean(e.variantsText, 160)}` : ''}` +
      `${e.successorOf ? ` · AA 미수록 · 선행 지수 하한(${clean(e.successorOf, 40)})` : ''} · ${fmtChg(e.change)}`);
  }
  for (const x of result.exits.slice(0, EXIT_LIMIT))
    lines.push(`• 이탈: ${clean(x.modelId, NAME_LIMIT)} (전일 ${x.previousRank}위)`);
  if (result.exits.length > EXIT_LIMIT) lines.push(`• 그 외 이탈 ${result.exits.length - EXIT_LIMIT}개`);
  return lines;
}
function summarize(result: UnifiedResult): string[] {
  const leader = result.entries[0];
  const lead = leader ? `선두: ${leader.modelId} (${leader.indexText})` : '선두: 자료 부족';
  const items = result.entries, exits = result.exits.length;
  const changed = items.filter(e => e.change !== '유지' && e.change !== '신규').length;
  const newCount = items.filter(e => e.change === '신규').length;
  const newSuffix = newCount > 0 ? ` (신규 ${newCount}개)` : '';
  const note = items.length === 0 ? '자료 부족: 통합 Top10에 측정값이 없습니다.'
    : items.every(e => e.change === '신규') ? '변동: 첫 집계: 전일 비교 기록 없음'
    : `변동: 상위권 ${items.length}개 중 ${changed}개 순위·진입 변동${newSuffix}, 이탈 ${exits}개`;
  return ['## 요약', `- ${lead}`, `- ${note}`, '- 사실 기준 요약이며 추정 동향은 넣지 않습니다.'];
}
export function renderTop10Letter(data: Top10LetterInput): string {
  const lines: string[] = [
    `[AI 인사이트 데일리: ${data.publicationDate} KST (내부 전용)]`,
    '통합 Top10: 오케스트레이터 존(지능 ≥ 후보 최고 85%)·워커 존(코딩 ≥ 후보 최고 75%) 통과 모델, 보유 요금제 접근 가능만',
    ...summarize(data.unified),
    '',
    ...renderSection(data.unified),
    ...(data.planOptimal?.length ? ['', ...data.planOptimal] : ['']),
    '## 출처 및 안내',
    ...ATTRIBUTIONS,
    data.failedSources && data.failedSources.length > 0
      ? `수집 실패 소스: ${data.failedSources.slice(0, FAILURE_LIMIT).map(s => clean(s, 40)).join(', ')}` +
        (data.failedSources.length > FAILURE_LIMIT ? ` 외 ${data.failedSources.length - FAILURE_LIMIT}개` : '') : '전 소스 정상 수집',
    ...(data.partialSources?.length ? [`부분 수집 소스: ${data.partialSources.slice(0, FAILURE_LIMIT).map(s => clean(s, 40)).join(', ')}`] : []),
    '혼합 단가=(3×입력+출력)/4 USD/1M · 가성비=지수÷max(단가,0.01)',
    `정렬: 가성비 중 큰 값 → OR 사용량 → 속도 → 지수 · ${EXCLUSION_NOTE}`,
    '상세 지표는 SQLite 이력에서 확인할 수 있습니다.',
    ...(data.notes ?? []).map(note => clean(note, 160)),
  ];
  let text = lines.join('\n');
  if (text.length > 3000) { // 필수 필드(역할/지수/접근)를 지키기 위해 이름을 먼저 줄인다(원문 저장은 유지)
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
  readonly partialSources?: readonly string[] }
/** Builds the compact letter from letter rows (no I/O): unified zone policy over AA indices. */
export function renderTop10FromRecords(input: CompactLetterInput): string {
  const options = { ...(input.arenaRecords && { arenaRecords: input.arenaRecords }), ...(input.openrouterRecords && { openrouterRecords: input.openrouterRecords }),
    ...(input.previousRanks && { previousCohort: input.previousRanks }) };
  const planOptimal = renderPlanOptimalLines(input.records);
  return renderTop10Letter({ publicationDate: input.publicationDate, unified: computeUnifiedTop10(input.records, options),
    ...(input.failedSources && { failedSources: input.failedSources }),
    ...(input.notes && { notes: input.notes }), ...(planOptimal.length && { planOptimal }),
    ...(input.partialSources && { partialSources: input.partialSources }) });
}
