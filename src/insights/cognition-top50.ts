import type { InsightRecord } from './record.js';
import type { ParseRowResult } from './parse-utils.js';

export const COGNITION_TOP_N = 50;
/** 조회·표시용: 비교 가능한 카테고리(rev/effort/subset)별 `correct` 상위 N개(경계 동점 포함)를 합집합으로
 *  유지하고, 유지된 모델의 모든 지표를 보존한다. 저장은 전체 rows를 보존하고 이 컷은 조회 단계
 *  (report-cohort)에서만 적용한다(p5 설계 §1). Scores are never mixed across categories:
 *  the category column already encodes rev/effort/subset. */
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
