import type { UsageDelta, UsageDeltaMetric } from '../../domain/usage-delta-types.js';
import { formatNumber } from './format.js';

/** Representative metric preference: percent first, then the window's base unit. */
const order: readonly UsageDeltaMetric[] = ['percent', 'used', 'remaining', 'limit'];
const MINUTE_MS = 60_000;
/** Non-breaking space keeps the "Δ" glyph bound to its value (never split by word wrap). */
const NBSP = '\u00A0';

/** 큰 수를 축약한다: 1,234,567 → 1.24M, 1200 → 1.2K, 999 → 999. */
function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${formatNumber(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${formatNumber(abs / 1_000)}K`;
  return formatNumber(value);
}

/** 경과 시간을 큰 단위 2개로 짧게 표시한다(예: "2h", "2h 5m", "6d 18h"). */
function formatElapsed(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE_MS));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** Usage 칸 접미용: 대표 지표 1개만(`Δ\u00A0+4.2%p / 2h`). percent는 %p(절대차),
 * 없으면 창 unit. "Δ"와 값은 NBSP로 묶여 쪼개지지 않는다.
 * 이력이 없을 때(`no-previous`)는 잡음을 줄이려 표기를 생략하고 undefined를 반환한다. */
export function formatDelta(delta: UsageDelta, unit: string): string | undefined {
  if (delta.status === 'n/a') return delta.reason === 'no-previous' ? undefined : `Δ${NBSP}n/a`;
  if (delta.status === 'reset') return `Δ${NBSP}reset`;
  const metric = order.find(candidate => delta.values[candidate] !== undefined);
  if (metric === undefined) return `Δ${NBSP}n/a`;
  const value = delta.values[metric]!;
  const suffix = metric === 'percent' ? '%p' : unit ? ` ${unit}` : '';
  const elapsed = formatElapsed(delta.elapsedMs);
  return `Δ${NBSP}${value > 0 ? '+' : ''}${formatCompact(value)}${suffix}${elapsed ? ` / ${elapsed}` : ''}`;
}

/** pretty 푸터 한 줄용 캐시 hit 표기. 1초 미만은 "<1s ago". */
export function formatCacheHit(provider: string, ageMs: number): string {
  const seconds = Math.round(Math.max(0, ageMs) / 1000);
  return `${provider} hit ${seconds < 1 ? '<1s' : `${seconds}s`} ago`;
}
