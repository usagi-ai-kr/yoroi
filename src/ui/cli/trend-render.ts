import Table from 'cli-table3';
import pc from 'picocolors';
import type { TrendPeriod, TrendPeriodStats } from '../../domain/trend-calc.js';
import type { ProviderId } from '../../domain/usage.js';

export interface SeriesTrendResult {
  provider: ProviderId | string;
  windowId: string;
  unit: string;
  contractVersion: string;
  periods: Partial<Record<TrendPeriod, TrendPeriodStats>>;
  sparklinePoints?: readonly (number | null)[];
}

const BARS = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
/** Percent-window deltas are percentage points, not percent change: display as %p (JSON keeps raw unit). */
const unitLabel = (unit: string): string => (unit === 'percent' || unit === '%' ? '%p' : unit);

export function renderSparkline(pts: readonly (number | null)[]): string {
  const nums = pts.filter((p): p is number => p !== null && Number.isFinite(p));
  if (nums.length < 2) return '-';
  const min = Math.min(...nums), max = Math.max(...nums);
  if (min === max) return '▄'.repeat(pts.length);
  return pts.map(p => (p === null || !Number.isFinite(p)) ? ' '
    : BARS[Math.min(7, Math.max(0, Math.floor(((p - min) / (max - min)) * 7)))]).join('');
}

function fmtStat(s: TrendPeriodStats | undefined, p: TrendPeriod, unit: string): string {
  if (!s || s.status === 'empty') return `${p}: samples=0 (샘플 부족)`;
  if (s.status === 'insufficient') return `${p}: samples=${s.sampleCount} (샘플 부족)`;
  const d = (s.delta ?? 0) >= 0 ? `+${s.delta}` : `${s.delta}`;
  const r = (s.ratePerHour ?? 0) >= 0 ? `+${s.ratePerHour}` : `${s.ratePerHour}`;
  const label = unitLabel(unit);
  const base = `${p}: delta=${d}${label} rate=${r}${label}/h samples=${s.sampleCount}${s.gapWarning ? ' gap=warning' : ''}`;
  return p === '7d' ? `${base} resets=${s.resets} gaps=${s.gaps}` : base;
}

export function renderTrendText(results: readonly SeriesTrendResult[], since?: TrendPeriod): string[] {
  return results.map(r => {
    const head = `${r.provider} ${r.windowId} ${r.unit}`;
    if (since) return `${head} ${fmtStat(r.periods[since], since, r.unit)}`;
    return `${head} ${fmtStat(r.periods['24h'], '24h', r.unit)} | ${fmtStat(r.periods['7d'], '7d', r.unit)}`;
  });
}

function fmtCol(s: TrendPeriodStats | undefined, unit: string, is7d: boolean): string {
  if (!s || s.status === 'empty') return '-';
  if (s.status === 'insufficient') return `샘플 부족 (${s.sampleCount})`;
  const d = (s.delta ?? 0) >= 0 ? `+${s.delta}` : `${s.delta}`;
  const r = (s.ratePerHour ?? 0) >= 0 ? `+${s.ratePerHour}` : `${s.ratePerHour}`;
  const label = unitLabel(unit);
  const text = `Δ${d}${label}\n${r}${label}/h (${s.sampleCount})${s.gapWarning ? '\ngap=warning' : ''}`;
  return is7d && s.resets > 0 ? `${text}\nreset:${s.resets}` : text;
}

export function renderTrendPretty(results: readonly SeriesTrendResult[]): string[] {
  const useColor = Boolean(pc.isColorSupported && process.env.FORCE_COLOR !== '0');
  const colors = pc.createColors(useColor);
  const head = ['Provider', 'Window', 'Unit', '24h Δ / 속도', '7d Δ / 속도 / 리셋', '7d Sparkline'];
  const table = new Table({
    head: head.map(h => colors.bold(h)),
    colWidths: [12, 10, 10, 18, 22, 16],
    wordWrap: true,
    style: { head: [], border: [] },
  });
  for (const r of results) {
    table.push([
      r.provider, r.windowId, r.unit,
      fmtCol(r.periods['24h'], r.unit, false),
      fmtCol(r.periods['7d'], r.unit, true),
      r.sparklinePoints ? renderSparkline(r.sparklinePoints) : renderSparkline([]),
    ]);
  }
  return table.toString().split('\n');
}

export function renderTrendJsonl(results: readonly SeriesTrendResult[]): string[] {
  return results.map(r => {
    const periods: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r.periods)) {
      if (!v) continue;
      periods[k] = {
        status: v.status, samples: v.sampleCount, delta: v.delta, ratePerHour: v.ratePerHour,
        resets: v.resets, gaps: v.gaps, gapWarning: Boolean(v.gapWarning), firstAt: v.first?.at, lastAt: v.last?.at,
      };
    }
    return JSON.stringify({
      provider: r.provider, windowId: r.windowId, unit: r.unit,
      contractVersion: r.contractVersion, periods,
    });
  });
}
