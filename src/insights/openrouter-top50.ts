import type { ParseRowResult } from './parse-utils.js';

export const OPENROUTER_TOP_N = 50;
/** Per comparison date, keep the top N models by total_tokens (ties at the cutoff included).
 * The `other` aggregate row (metadata.aggregate) never consumes a model slot but is always preserved
 * separately, matching the storage contract (Top 50 models + other). Non-ok rows stay for validation. */
export function filterOpenRouterTop50(results: readonly ParseRowResult[], limit = OPENROUTER_TOP_N): ParseRowResult[] {
  const keep = new Set<number>();
  const byDate = new Map<string, { index: number; value: number }[]>();
  for (const row of results) {
    if (!row.ok) continue;
    const record = row.records[0];
    const date = record?.metadata?.date;
    if (record === undefined || typeof date !== 'string') { keep.add(row.index); continue; }
    if (record.metadata?.aggregate === true || record.modelId.trim().toLowerCase() === 'other') { keep.add(row.index); continue; }
    const entry = { index: row.index, value: record.value };
    const list = byDate.get(date);
    if (list) list.push(entry);
    else byDate.set(date, [entry]);
  }
  for (const list of byDate.values()) {
    const values = list.map(entry => entry.value).sort((a, b) => b - a);
    const cutoff = values.length <= limit ? -Infinity : values[limit - 1]!;
    for (const entry of list) if (entry.value >= cutoff) keep.add(entry.index);
  }
  return results.filter(row => !row.ok || keep.has(row.index));
}
