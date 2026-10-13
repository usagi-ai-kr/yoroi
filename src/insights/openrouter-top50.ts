import type { ParseRowResult } from './parse-utils.js';

export const OPENROUTER_TOP_N = 50;
/** 조회·표시용: 비교 날짜별로 total_tokens 상위 N개(경계 동점 포함)를 유지한다.
 *  `other` 집계 행(metadata.aggregate)은 모델 슬롯을 쓰지 않고 항상 보존한다.
 *  저장은 전체 rows를 보존하고 이 컷은 조회 단계(report-cohort)에서만 적용한다(p5 설계 §1). Non-ok rows stay. */
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
