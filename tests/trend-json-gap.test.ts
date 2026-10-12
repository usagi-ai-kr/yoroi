import assert from 'node:assert/strict';
import test from 'node:test';
import { computeTrendStats, type TrendObservation } from '../src/domain/trend-calc.js';
import { renderTrendJsonl } from '../src/ui/cli/trend-render.js';

const obs = (at: string, percent: number): TrendObservation => ({ provider: 'claude', scope: 'main',
  contractVersion: 'v1', observedAt: at, window: { id: '5h', unit: 'percent', percent, resetAt: '2026-10-11T00:00:00Z' } });
const jsonl = (periods: Parameters<typeof renderTrendJsonl>[0][number]['periods']): Record<string, unknown> =>
  JSON.parse(renderTrendJsonl([{ provider: 'claude', windowId: '5h', unit: 'percent', contractVersion: 'v1', periods }])[0]!);

test('JSON periods carry gapWarning true/false without changing numeric units', () => {
  const now = Date.parse('2026-10-10T00:00:00Z');
  const gapped = computeTrendStats([obs('2026-10-04T00:00:00Z', 10), obs('2026-10-09T00:00:00Z', 40)], '7d', now);
  const tight = computeTrendStats([obs('2026-10-09T22:00:00Z', 10), obs('2026-10-10T00:00:00Z', 20)], '7d', now);
  const gappedJson = jsonl({ '7d': gapped }), tightJson = jsonl({ '7d': tight });
  assert.equal((gappedJson.periods as Record<string, Record<string, unknown>>)['7d']!.gapWarning, true);
  assert.equal((tightJson.periods as Record<string, Record<string, unknown>>)['7d']!.gapWarning, false);
  assert.equal((gappedJson.periods as Record<string, Record<string, unknown>>)['7d']!.delta, 30);
  assert.equal((gappedJson.periods as Record<string, Record<string, unknown>>)['7d']!.ratePerHour, 0.25);
  assert.equal(gappedJson.unit, 'percent', 'JSON keeps the raw unit');
});
test('empty and insufficient periods serialize gapWarning=false explicitly', () => {
  const now = Date.parse('2026-10-10T00:00:00Z');
  const empty = computeTrendStats([], '24h', now);
  const insufficient = computeTrendStats([obs('2026-10-10T00:00:00Z', 10)], '24h', now);
  const out = jsonl({ '24h': empty, '7d': insufficient });
  const periods = out.periods as Record<string, Record<string, unknown>>;
  assert.equal(periods['24h']!.gapWarning, false);
  assert.equal(periods['7d']!.gapWarning, false);
  assert.equal(periods['24h']!.status, 'empty');
});
