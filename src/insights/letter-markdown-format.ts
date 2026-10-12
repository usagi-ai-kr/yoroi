import { SOURCE_ATTRIBUTIONS } from './source-attribution.js';
import { ROLE_SCORE_WEIGHTS } from './letter-top10-worker.js';

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

/** 스코어 산출 공식 문구. 가중치는 letter-top10-worker.ts 상수에서 직접 읽어 렌더/코드 드리프트를 막는다. */
export const SCORE_FORMULA_LINES: readonly string[] = [
  '- 스코어 = 100 × Σ(가중치 × 정규화값), 스코어 내림차순 정렬(동점 시 지수)',
  `- 가중치 오케스트레이터: 지수 ${ROLE_SCORE_WEIGHTS.orchestrator.index} · 비용 ${ROLE_SCORE_WEIGHTS.orchestrator.cost} · 사용량 ${ROLE_SCORE_WEIGHTS.orchestrator.usage} · 속도 ${ROLE_SCORE_WEIGHTS.orchestrator.speed} / 워커: 지수 ${ROLE_SCORE_WEIGHTS.worker.index} · 비용 ${ROLE_SCORE_WEIGHTS.worker.cost} · 사용량 ${ROLE_SCORE_WEIGHTS.worker.usage} · 속도 ${ROLE_SCORE_WEIGHTS.worker.speed}`,
  '- 정규화: 역할별 후보 풀 min-max(비용·사용량·속도는 log10, 싼 쪽·빠른 쪽 1), 단가 결측 0·사용량 결측 0·속도 결측 중앙값',
  '- 추천 effort: 변형별 실효 단가(혼합 단가 × cost_per_task 비율)로 스코어링한 최고 변형',
  '- default: AA에 effort 변형 또는 cost_per_task가 없어 단일 구성으로 평가',
];
