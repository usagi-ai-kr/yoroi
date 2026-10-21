import { PARETO_MARK } from './letter-top10-legend.js';
import type { CalibrationRunRecord } from './calibration-store.js';
import type { FreeCell, FreeRow } from './letter-markdown-free-sort.js';

/** #196: Free 경로 문자열 열은 제거하고 플랜별 체크 열로 바꾼다(확인된 플랜명 기준). */
const PATH: Readonly<Record<string, string>> = {
  'OpenCode Zen Free': 'OpenCode Zen Free',
  'OpenCode Go Free': 'OpenCode Go Free',
};
export const FREE_ZEN = 'OpenCode Zen Free';
export const FREE_GO = 'OpenCode Go Free';
/** #196: Zen·Go 체크. 확인되면 ✓, 아니면 빈 칸(빈 칸은 공식 사용 불가 단정이 아니다). */
export const freePlanCheck = (plans: readonly string[], plan: string): string =>
  plans.some(p => (PATH[p] ?? p) === plan) ? '✓' : '';
/** #196: 작업 가능성 열은 의미 있는 측정이 절반 이상일 때만(대부분 미검증이면 숨김). */
export const hasMeaningfulWorkability = (rows: readonly FreeRow[]): boolean => {
  if (!rows.length) return false;
  const meaningful = rows.filter(row => calibrationCell(calOf(row)) !== '미검증').length;
  return meaningful * 2 >= rows.length;
};
const WORKABILITY_HEADER = '| 모델 | 오케 | 워커 | AA 지수 | Zen | Go | 비고 | 작업 가능성 |\n| --- | --- | --- | --- | --- | --- | --- | --- |';
const PLAIN_HEADER = '| 모델 | 오케 | 워커 | AA 지수 | Zen | Go | 비고 |\n| --- | --- | --- | --- | --- | --- | --- |';
const REVIEWER_WORKABILITY_HEADER = '| 모델 | 오케 | 리뷰어 | 워커 | AA 지수 | Zen | Go | 비고 | 작업 가능성 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |';
const REVIEWER_PLAIN_HEADER = '| 모델 | 오케 | 리뷰어 | 워커 | AA 지수 | Zen | Go | 비고 |\n| --- | --- | --- | --- | --- | --- | --- | --- |';
export const FREE_TABLE_HEADER = WORKABILITY_HEADER;
export const freeTableHeader = (withWorkability: boolean): string => withWorkability ? WORKABILITY_HEADER : PLAIN_HEADER;
export const FREE_TABLE_HEADERS: readonly string[] = [WORKABILITY_HEADER, PLAIN_HEADER,
  REVIEWER_WORKABILITY_HEADER, REVIEWER_PLAIN_HEADER];
export const freeReviewerTableHeader = (withWorkability: boolean): string =>
  withWorkability ? REVIEWER_WORKABILITY_HEADER : REVIEWER_PLAIN_HEADER;
/** 영역 칸: 자격 통과 `✓ 스코어`, 근거는 있고 미달 `✗`, 근거 없음 `-`. */
export const freeCell = (cell?: FreeCell): string => cell === undefined ? '-' : cell.passed ? `✓ ${cell.score}` : '✗';
/** #196: 비고에는 확인된 실질 정보만(파레토·검증된 상한). 미확인 effort 표기는 화면에서 숨기되 내부 값은 유지한다. */
const effortNote = (effort?: string): string => {
  if (!effort || effort.includes('(미확인)')) return '';
  return `effort ${effort}`;
};
export const freeNote = (row: FreeRow): string => row.unmeasured ? '근거 없음'
  : [row.pareto ? `${PARETO_MARK} 파레토` : '', effortNote(row.effort)].filter(Boolean).join(' · ') || '-';
/** #180 unit 5: 작업 가능성 보충칸. scorer 판정 우선, 잠정은 잠정 표기. */
export type CalibratedFreeRow = FreeRow & { readonly calibration?: readonly CalibrationRunRecord[] };
const calOf = (row: FreeRow): readonly CalibrationRunRecord[] | undefined =>
  (row as CalibratedFreeRow).calibration;
export const withCalibration = (
  rows: readonly FreeRow[],
  lookup?: (modelId: string) => readonly CalibrationRunRecord[] | undefined,
): readonly FreeRow[] => lookup === undefined ? rows : rows.map(r => ({ ...r, calibration: lookup(r.modelId) }));
export const calibrationCell = (rows: readonly CalibrationRunRecord[] | undefined): string => {
  const latest = rows?.[0];
  if (!latest) return '미검증';
  const date = latest.runAt.slice(0, 10);
  if (latest.sampleStatus !== 'stable') return `측정 부족 · 잠정 · ${latest.sampleCount}회 · ${date}`;
  if (latest.verdict === 'capable' || latest.verdict === 'assistant') {
    const head = latest.verdict === 'capable' ? '작업 가능' : '보조 가능';
    return `${head} · ${latest.totalScore}/100 · ${latest.sampleCount}회 · task-set ${latest.taskSetVersion} · ${date}`;
  }
  return '권장하지 않음';
};
/** #196: 미검증 칸은 화면에서 숨긴다(측정 자체가 없으므로). 내부 근거는 레코드로 유지된다. */
export const workabilityCell = (row: FreeRow): string => {
  const cell = calibrationCell(calOf(row));
  return cell === '미검증' ? '' : cell;
};
/** #194: Free 표의 모델 열은 표시용으로만 '-free' 접미사를 뗀다(내부 id 는 유지). */
export const freeDisplayId = (modelId: string): string => modelId.replace(/-free$/, '');
export const freeMarkdownRows = (rows: readonly FreeRow[], withWorkability = hasMeaningfulWorkability(rows)): string[] => rows.map(row =>
  `| ${freeDisplayId(row.modelId)} | ${freeCell(row.orchestrator)} | ${freeCell(row.worker)} | ${row.indexText ?? '-'} | ${freePlanCheck(row.plans, FREE_ZEN)} | ${freePlanCheck(row.plans, FREE_GO)} | ${freeNote(row)}${withWorkability ? ` | ${workabilityCell(row)}` : ''} |`);
/** 3역할 표 행: 리뷰어 열을 오케·워커 사이에 둔다. 리뷰어 근거 없음은 '-'. */
export const freeMarkdownRowsWithReviewer = (rows: readonly FreeRow[], withWorkability = hasMeaningfulWorkability(rows)): string[] => rows.map(row =>
  `| ${freeDisplayId(row.modelId)} | ${freeCell(row.orchestrator)} | ${freeCell(row.reviewer)} | ${freeCell(row.worker)} | ${row.indexText ?? '-'} | ${freePlanCheck(row.plans, FREE_ZEN)} | ${freePlanCheck(row.plans, FREE_GO)} | ${freeNote(row)}${withWorkability ? ` | ${workabilityCell(row)}` : ''} |`);
/** #196: compact는 확인된 플랜만 짧게(Zen ✓ / Go ✓). */
export const freePlanChecksShort = (plans: readonly string[]): string =>
  [freePlanCheck(plans, FREE_ZEN) ? `Zen ✓` : '', freePlanCheck(plans, FREE_GO) ? `Go ✓` : ''].filter(Boolean).join(' ');
export const freeCompactRows = (rows: readonly FreeRow[]): string[] => rows.map(row =>
  `${row.modelId} · 오케 ${freeCell(row.orchestrator)} · 워커 ${freeCell(row.worker)} · ${freePlanChecksShort(row.plans)} · ${freeNote(row)}`);
