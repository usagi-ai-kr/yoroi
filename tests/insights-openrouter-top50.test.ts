import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOpenRouterTop50 } from '../src/insights/openrouter-top50.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';

const row = (index: number, date: string, value: number, ok = true): ParseRowResult => ok
  ? { ok: true, index, records: [{ source: 'openrouter', modelId: `m${index}`, metric: 'total_tokens', value,
      unit: 'tokens', category: 'usage', observedAt: '2026-10-12T00:00:00Z', sourceAsOf: '2026-10-12T00:00:00Z',
      sourceUrl: 'https://openrouter.ai/rankings', sourceName: 'OpenRouter', license: 'CC-BY-4.0',
      attributionText: 'x', method: 'official-api', schemaVersion: 'v1', metadata: { date } }], warnings: [] }
  : { ok: false, index, reason: 'OpenRouter invalid-row', warnings: [] };

test('selection applies per comparison date with ties at each cutoff kept', () => {
  const rows = [...Array.from({ length: 60 }, (_, i) => row(i, '2026-10-10', 1000 - i)),
    row(60, '2026-10-10', 951), row(61, '2026-10-09', 1), row(62, '2026-10-09', 2), row(63, 'bad', 5, false)];
  const kept = filterOpenRouterTop50(rows, 50).map(entry => entry.index).sort((a, b) => a - b);
  assert.equal(kept.length, 54);
  assert.ok(kept.includes(49));           // 50th by value (cutoff)
  assert.ok(kept.includes(60));           // tie at the cutoff
  assert.ok(!kept.includes(50));          // just below the cutoff
  assert.ok(kept.includes(61) && kept.includes(62)); // other date keeps its own top N
  assert.ok(kept.includes(63));           // non-ok rows stay for validation reporting
});
