import type { InsightRecord } from './record.js';

export const VALUE_TOP_N = 50;

interface ModelMetrics {
  coding: number | null;
  intel: number | null;
  input: number | null;
  output: number | null;
}

function efficiency(index: number, input: number | null, output: number | null): number | null {
  if (input === null || output === null) return null;
  if (input < 0 || output < 0 || !Number.isFinite(input) || !Number.isFinite(output)) return null;
  const cost = Math.max((3 * input + output) / 4, 0.01);
  if (cost <= 0 || !Number.isFinite(cost)) return null;
  const eff = index / cost;
  return Number.isFinite(eff) ? eff : null;
}

function topBy(metrics: Map<string, ModelMetrics>, key: 'coding' | 'intel', limit: number): string[] {
  const scored = [...metrics.entries()]
    .filter(([, m]) => m[key] !== null && Number.isFinite(m[key]!))
    .map(([modelId, m]) => ({ modelId, score: m[key]! }));
  if (scored.length === 0) return [];
  scored.sort((a, b) => b.score - a.score);
  const cutoff = scored.length <= limit ? -Infinity : scored[limit - 1]!.score;
  return scored.filter(m => m.score >= cutoff).map(m => m.modelId);
}

function topByEff(metrics: Map<string, ModelMetrics>, key: 'coding' | 'intel', limit: number): string[] {
  const scored = [...metrics.entries()]
    .map(([modelId, m]) => {
      const index = m[key];
      if (index === null || !Number.isFinite(index)) return null;
      const eff = efficiency(index, m.input, m.output);
      if (eff === null) return null;
      return { modelId, eff };
    })
    .filter((m): m is { modelId: string; eff: number } => m !== null);
  if (scored.length === 0) return [];
  scored.sort((a, b) => b.eff - a.eff);
  const cutoff = scored.length <= limit ? -Infinity : scored[limit - 1]!.eff;
  return scored.filter(m => m.eff >= cutoff).map(m => m.modelId);
}

/** 조회·표시용 top50 선택(저장 경로는 호출하지 않는다, p5 설계 §1).
 *  AA Top10 후보 풀은 전체 records를 쓰고 이 선택기로 재제한하지 않는다. */
export function selectAaValueTop(records: readonly InsightRecord[], limit = VALUE_TOP_N): InsightRecord[] {
  const byModel = new Map<string, InsightRecord[]>();
  const metrics = new Map<string, ModelMetrics>();
  for (const r of records) {
    if (!byModel.has(r.modelId)) byModel.set(r.modelId, []);
    byModel.get(r.modelId)!.push(r);
    if (!metrics.has(r.modelId)) metrics.set(r.modelId, { coding: null, intel: null, input: null, output: null });
    const m = metrics.get(r.modelId)!;
    if (r.metric === 'artificial_analysis_coding_index') m.coding = r.value;
    if (r.metric === 'artificial_analysis_intelligence_index') m.intel = r.value;
    if (r.metric === 'price_1m_input_tokens') m.input = r.value;
    if (r.metric === 'price_1m_output_tokens') m.output = r.value;
  }
  const codingTop = topBy(metrics, 'coding', limit);
  const intelTop = topBy(metrics, 'intel', limit);
  const codingEffTop = topByEff(metrics, 'coding', limit);
  const intelEffTop = topByEff(metrics, 'intel', limit);
  const selected = new Set([...codingTop, ...intelTop, ...codingEffTop, ...intelEffTop]);
  const result: InsightRecord[] = [];
  for (const modelId of selected) result.push(...(byModel.get(modelId) ?? []));
  return result;
}
