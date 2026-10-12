import { SOURCE_ATTRIBUTIONS } from './source-attribution.js';

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
