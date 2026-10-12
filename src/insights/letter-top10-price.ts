import type { ValidatedInsightRecord } from './validation.js';

export interface ModelPrices { readonly input?: number; readonly output?: number }
/** AA 가격 metric(price_1m_input_tokens/price_1m_output_tokens)만 모아 모델별 단가 맵을 만든다. 결측은 키 없음. */
export function buildPriceMap(records: readonly ValidatedInsightRecord[]): Map<string, ModelPrices> {
  const prices = new Map<string, ModelPrices>();
  for (const v of records) {
    const metric = v.record.metric;
    if (metric !== 'price_1m_input_tokens' && metric !== 'price_1m_output_tokens') continue;
    const entry = prices.get(v.record.modelId) ?? {};
    prices.set(v.record.modelId, metric === 'price_1m_input_tokens'
      ? { ...entry, input: v.record.value } : { ...entry, output: v.record.value });
  }
  return prices;
}
