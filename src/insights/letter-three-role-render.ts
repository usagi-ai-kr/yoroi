import { PARETO_MARK } from './letter-top10-legend.js';
import { roleFitNote, roleFitLegend, type RoleFitRole } from './model-role-fit.js';

/** #195 단위3: 세 역할(오케스트레이터·리뷰어·워커) 목록의 독립 Markdown 렌더러.
 *  기본 꺼짐(default-off) — 기존 레터 출력·렌더러·CLI·발행에 연결하지 않는다. */

/** 입력 항목: 단위2 선택 결과(selected lists)와 호환되는 형태. 값은 전달된 그대로 그린다. */
export interface ThreeRoleEntry {
  readonly modelId: string;
  readonly rank?: number;
  readonly score?: number;
  readonly effort?: string;
  readonly isPareto?: boolean;
  readonly unconfirmed?: boolean;
  readonly weightOpen?: boolean;
  readonly [key: string]: unknown;
}

export type ThreeRoleKey = 'orchestrator' | 'reviewer' | 'worker';

export interface ThreeRoleRenderInput {
  readonly orchestrator?: readonly ThreeRoleEntry[];
  readonly reviewer?: readonly ThreeRoleEntry[];
  readonly worker?: readonly ThreeRoleEntry[];
  /** 7(기본) 또는 15 — 섹션 제목의 Top7/Top15와 표시 행 수를 정한다. */
  readonly depth?: number;
  readonly publicationDate?: string;
}

export const THREE_ROLE_ORDER: readonly ThreeRoleKey[] = ['orchestrator', 'reviewer', 'worker'];
export const THREE_ROLE_TITLES: Record<ThreeRoleKey, string> = {
  orchestrator: '🧭 오케스트레이터', reviewer: '🔍 리뷰어', worker: '🛠️ 워커·메신저' };
export const THREE_ROLE_LEGEND: readonly string[] = [
  '## 📖 표시 안내',
  '- 👍 파레토 최적',
  '- 스코어·effort 는 전달된 값 그대로(가중치·점수를 새로 계산하지 않는다) · 빈 값은 "-"',
  ...roleFitLegend(),
];

/** control/bidi 문자 제거 + 자격정보 마스킹 — 기존 레터 렌더러(letter-top10-render.ts)의 clean 규칙과 동일.
 *  해당 헬퍼는 비공개여서 규칙만 재현했고 비밀값은 담지 않는다. */
const clean = (value: string, limit = 120): string => value
  .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
  .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, ' ')
  .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
  .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)\s*[:=]\s*[^\s&]+/gi, '[redacted]')
  .replace(/\b(?:sk-|sk_|hf_|gh[pousr]_)[A-Za-z0-9_-]{4,}/g, '[redacted]').slice(0, limit);
const textCell = (value: unknown): string => typeof value === 'string' && value.trim() ? clean(value) : '-';
const scoreCell = (value: unknown): string => typeof value === 'number' && Number.isFinite(value) ? String(value) : '-';
const rankCell = (entry: ThreeRoleEntry, index: number): string =>
  typeof entry.rank === 'number' && Number.isFinite(entry.rank) ? String(entry.rank) : String(index + 1);
/** 비고 칸: 정성 역할 적합성 노트(usagi 관찰). 점수·순위에는 영향 없음(렌더 전용). */
const noteCell = (entry: ThreeRoleEntry, role: RoleFitRole): string => roleFitNote(entry.modelId, role) ?? '-';
/** 모델 열은 base id 로(있다면 baseModelId) — effort 접미사('claude-sonnet-5-5-xhigh')를 숨긴다. */
const modelCell = (entry: ThreeRoleEntry): string => {
  const base = typeof entry.baseModelId === 'string' && entry.baseModelId.trim() ? entry.baseModelId : entry.modelId;
  return textCell(typeof base === 'string' ? base.replace(/-(?:free|minimal|low|medium|high|xhigh|max)$/, '') : base);
};
const rowFor = (entry: ThreeRoleEntry, index: number, role: RoleFitRole): string =>
  `| ${rankCell(entry, index)} | ${entry.isPareto === true ? PARETO_MARK : ''} | ${modelCell(entry)} | ${scoreCell(entry.score)} | ${textCell(entry.effort)} | ${textCell(noteCell(entry, role))} |`;
const tableHead = '| 순위 | 파레토 | 모델 | 스코어 | effort | 비고 |\n| --- | --- | --- | --- | --- | --- |';

/** 역할 하나를 Top7/Top15 섹션으로 그린다. 목록이 비면 빈 줄 대신 상태를 한 줄 남긴다. */
export function renderThreeRoleSection(key: ThreeRoleKey, entries: readonly ThreeRoleEntry[], depth: number): string {
  const label = depth === 15 ? 'Top15' : 'Top7';
  const heading = `## ${THREE_ROLE_TITLES[key]} ${label}`;
  const rows = entries.slice(0, depth);
  if (!rows.length) return `${heading}\n\n- (목록 없음)`;
  return [heading, '', tableHead, ...rows.map((entry, index) => rowFor(entry, index, key as RoleFitRole))].join('\n');
}

/** 세 역할 섹션 + compact 범례. 같은 입력 → 같은 출력(정렬·무작위 없음). */
export function renderThreeRoleMarkdown(input: ThreeRoleRenderInput): string {
  const depth = input.depth === 15 ? 15 : 7;
  const lists: Record<ThreeRoleKey, readonly ThreeRoleEntry[]> = {
    orchestrator: input.orchestrator ?? [], reviewer: input.reviewer ?? [], worker: input.worker ?? [] };
  const sections = THREE_ROLE_ORDER.map(key => renderThreeRoleSection(key, lists[key], depth));
  const date = input.publicationDate ? ` (${clean(input.publicationDate, 10)})` : '';
  return [`# 3역할 리포트${date}`, '', ...sections.flatMap(section => [section, '']), ...THREE_ROLE_LEGEND].join('\n');
}
