import { SourceError } from '../app/usage-source.js';
import { createSnapshot, type UsageWindow } from '../domain/usage.js';

/** SuperGrok 한도는 주간 단위(xai-org/grok-build USAGE_PERIOD_TYPE_WEEKLY)라 stats 창을 7일로 맞춘다. */
export const XAI_STATS_DAYS = 7;

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SourceError('parse');
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new SourceError('parse');
  return value;
}

/** Sums `opencode stats --json --models --cost` rows whose providerID is `xai`.
 * Only consumption (`used`) is known: the output has no limit, remaining or reset, so none is invented.
 * No xai row means no xai usage in the window, so every window reports `used: 0`.
 * Cache tokens are excluded from `tokens`; `cost-estimate` is opencode's own price-table estimate (USD assumed). */
export function parseXaiOpencodeStats(stdout: string, observedAt: string, days = XAI_STATS_DAYS) {
  let root: Record<string, unknown>;
  try { root = record(JSON.parse(stdout)); } catch { throw new SourceError('parse'); }
  if (!Array.isArray(root.models)) throw new SourceError('parse');
  let steps = 0, tokens = 0, cost = 0;
  for (const item of root.models) {
    const row = record(item);
    if (record(row.model).providerID !== 'xai') continue;
    const used = record(row.tokens);
    steps += count(row.steps);
    cost += count(row.cost);
    tokens += count(used.input) + count(used.output) + count(used.reasoning);
  }
  const id = (metric: string) => `xai:${days}d:${metric}`;
  const windows: UsageWindow[] = [
    { id: id('tokens'), unit: 'tokens', used: tokens },
    { id: id('steps'), unit: 'steps', used: steps },
    { id: id('cost-estimate'), unit: 'usd', used: Math.round(cost * 1e6) / 1e6 },
  ];
  try { return createSnapshot('xai', observedAt, windows); } catch { throw new SourceError('parse'); }
}
