import { SOURCE_ATTRIBUTIONS } from './source-attribution.js';
import { DIMENSION_LABELS, ROLE_DIMENSION_WEIGHTS, ROLE_DIMENSIONS, WORKER_PERFORMANCE_FLOOR } from './letter-top10-score.js';
import type { OptimalZoneRole } from './letter-top10-worker.js';

export const MARKDOWN_LIMIT = 65536;
export const OMISSION_MARK = '(이하 생략 — 전체는 `--full`)';
/** Attribution lines follow the source registry so a new source (e.g. OpenCode Data) cannot be missed. */
export const SOURCE_LINES: readonly string[] = SOURCE_ATTRIBUTIONS;

export function escapeShields(text: string): string {
  return encodeURIComponent(text.replace(/_/g, '__').replace(/-/g, '--')).replace(/%20/g, '_');
}

export function statusBadge(failed: readonly string[], partial: readonly string[]): string {
  const [text, color] = failed.length ? [`${failed.length} failed`, 'critical']
    : partial.length ? [`${partial.length} partial`, 'warning'] : ['all healthy', 'success'];
  return `![status](https://img.shields.io/badge/status-${escapeShields(text)}-${color})`;
}

/** 실패 소스 안내 본문: 실패를 먼저, 부분 수집을 그다음에, 둘 다 없을 때만 정상 문구를 쓴다. */
export function sourceStatusLines(failed: readonly string[], partial: readonly string[]): string[] {
  const lines = failed.map(s => `- ⚠️ ${s}`);
  if (partial.length) lines.push(`- ⚠️ 부분 수집 소스: ${partial.join(', ')} (일부 행 거절·결측)`);
  if (!failed.length && !partial.length) lines.push('- 모든 소스 정상 수집 완료');
  return lines;
}

/** Cuts at a code-point boundary first (surrogate pairs stay intact) and then at the last row
 *  boundary, so a table row or the <details> block is never split mid-row; the omitted tail is
 *  marked with a pointer to `--full`. */
export function truncateAtRowBoundary(text: string, limit = MARKDOWN_LIMIT): string {
  if ([...text].length <= limit) return text;
  const clipped = [...text].slice(0, limit).join('');
  const cut = clipped.lastIndexOf('\n');
  return `${cut > 0 ? clipped.slice(0, cut) : clipped}\n\n${OMISSION_MARK}`;
}

/** 스코어 산출 공식 문구(p75: 오케 성능/사용량/속도 3차원, 워커 4차원, 역할별 가중치). 상수는 letter-top10-score.ts에서 읽는다. */
const weightsText = (role: OptimalZoneRole): string =>
  ROLE_DIMENSIONS[role].map(d => `${DIMENSION_LABELS[d]} ${Number(((ROLE_DIMENSION_WEIGHTS[role][d] ?? 0) * 100).toFixed(1))}%`).join('·');
export const SCORE_FORMULA_LINES: readonly string[] = [
  `- 스코어 = 100 × Σ(가중치 × 차원값), 결측 0점(재분배 없음), 동점 모델명`,
  `- 가중치: 오케·리뷰어 ${weightsText('orchestrator')} / 워커·메신저 ${weightsText('worker')}`,
  '- 성능: AA Int/Code·Cog 정답률; 사용량: 두 역할 OR/OCD 토큰(log10)',
  '- 속도: 오케 AA·Cog, 워커 AA; 워커 가격 결측 99',
  `- 워커 성능<${WORKER_PERFORMANCE_FLOOR}·결측 제외; 오케 E=전 변형 풀 표준화·P1 최고점(성능·사용량·속도, 동점 낮은 effort); AA 지수도 E값`,
  '- off-peak·파레토, score 원 API',
];
