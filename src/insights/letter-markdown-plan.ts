import { computePlanOptimal } from './plan-optimal.js';
import type { Top10RecordInput } from './letter-top10-rank.js';

const ROLE_LABEL = { orchestrator: '오케스트레이터', worker: '워커' } as const;

/** 요금제별 최적 존 1~3위를 마크다운 표로 렌더한다. computePlanOptimal가 verified=true 모델만
 *  고르므로 표시 매핑에도 비검증 모델은 나오지 않는다. 정액제는 추가 비용 0이라 지수 순
 *  (근거: docs/insights/top10-scoring.md §7). */
export function renderPlanOptimalMarkdown(records: readonly Top10RecordInput[]): string[] {
  const plans = new Map<string, { planName: string; rows: { role: string; entries: readonly { displayName: string; indexValue: number }[]; best?: number }[] }>();
  for (const role of ['orchestrator', 'worker'] as const) {
    for (const plan of computePlanOptimal(records, role)) {
      const bucket = plans.get(plan.planId) ?? { planName: plan.planName, rows: [] };
      bucket.rows.push({ role: ROLE_LABEL[role], entries: plan.entries, ...(plan.bestIndexValue !== undefined && { best: plan.bestIndexValue }) });
      plans.set(plan.planId, bucket);
    }
  }
  if (!plans.size) return [];
  const lines = ['## 💳 요금제상 최적', '', '| 요금제 | 관점 | 1~3위 모델 | 지수 |', '| --- | --- | --- | --- |'];
  for (const { planName, rows } of plans.values())
    for (const { role, entries, best } of rows)
      lines.push(`| ${planName} | ${role} | ${entries.length ? entries.map((e, i) => `${i + 1}위 ${e.displayName}`).join(' > ')
        : `최적 존 해당 없음 · 최고 ${best?.toFixed(1) ?? '-'}`} | ${entries.length ? entries.map(e => e.indexValue.toFixed(1)).join(' > ') : '-'} |`);
  lines.push('', '정액제는 추가 비용이 없어 지수 순');
  return lines;
}
