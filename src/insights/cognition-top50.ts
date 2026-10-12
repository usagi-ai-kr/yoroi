import type { InsightRecord } from './record.js';
import type { ParseRowResult } from './parse-utils.js';

export const COGNITION_TOP_N = 50;
/** Per comparable category (rev/effort/subset), keep the top N models by their best `correct` value
 * (ties at each cutoff included) and union the categories; every metric of a kept model stays.
 * Scores are never mixed across categories: the parser already encodes rev/effort/subset in `category`. */
export function filterCognitionTop50(results: readonly ParseRowResult[], limit = COGNITION_TOP_N): ParseRowResult[] {
  const byCategory = new Map<string, Map<string, number>>();
  for (const row of results) {
    if (!row.ok) continue;
    for (const record of row.records) {
      if (record.metric !== 'correct' || !Number.isFinite(record.value)) continue;
      const scores = byCategory.get(record.category) ?? new Map<string, number>();
      const best = scores.get(record.modelId);
      if (best === undefined || record.value > best) scores.set(record.modelId, record.value);
      byCategory.set(record.category, scores);
    }
  }
  const keep = new Set<string>();
  for (const scores of byCategory.values()) {
    const values = [...scores.values()].sort((a, b) => b - a);
    const cutoff = values.length <= limit ? -Infinity : values[limit - 1]!;
    for (const [modelId, score] of scores) if (score >= cutoff) keep.add(modelId);
  }
  if (keep.size === 0) return [...results];
  return results.filter(row => !row.ok || row.records.some(record => keep.has(record.modelId)));
}
