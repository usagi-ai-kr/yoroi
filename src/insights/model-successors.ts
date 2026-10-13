import type { InsightRecord } from './record.js';
import { findRegularRate } from './model-price-overrides.js';

export interface ModelSuccessorRule {
  readonly successor: string;
  readonly predecessor: string;
  readonly basis: string;
  readonly priceSource: string;
}

/** 후속 모델 매핑 표 (#108). */
export const MODEL_SUCCESSORS: readonly ModelSuccessorRule[] = [
  { successor: 'deepseek-v4.1-flash', predecessor: 'deepseek-v4-flash',
    basis: '사용자 확인 2026-10-12: 4.1 Flash가 4 Flash보다 상위',
    priceSource: 'https://api-docs.deepseek.com/quick_start/pricing' },
];

const METRICS_TO_COPY = new Set([
  'artificial_analysis_intelligence_index',
  'artificial_analysis_coding_index',
  'median_output_tokens_per_second',
]);

function makePriceRecord(template: InsightRecord, modelId: string, metric: string,
  value: number, sourceUrl: string, checkedOn: string, predecessor: string): InsightRecord {
  return {
    source: 'artificial-analysis', modelId, metric, value, unit: 'USD/1M tokens',
    category: template.category, observedAt: template.observedAt, sourceAsOf: template.sourceAsOf,
    sourceUrl, sourceName: template.sourceName, license: template.license,
    attributionText: template.attributionText, method: template.method, schemaVersion: template.schemaVersion,
    metadata: { successorOf: predecessor, priceBasis: 'official-regular', checkedOn },
  };
}

/**
 * AA 기록에 후속 모델이 없고 선행 모델이 있으면, 선행 모델의 지수/속도 값을
 * 하한으로 복사한 후속 모델 행을 추가한다.
 * 가격 metric은 복사하지 않고 model-price-overrides의 공식 정상 단가를 사용한다.
 * 후속 모델이 이미 있으면 아무것도 추가하지 않는다.
 */
export function expandSuccessors(records: readonly InsightRecord[]): InsightRecord[] {
  const result = [...records];
  const aaRecords = records.filter(r => r.source === 'artificial-analysis');
  const existingModels = new Set(aaRecords.map(r => r.modelId.trim().toLowerCase()));

  for (const rule of MODEL_SUCCESSORS) {
    if (existingModels.has(rule.successor.trim().toLowerCase())) continue;
    const predRecords = aaRecords.filter(r => r.modelId.trim().toLowerCase() === rule.predecessor.trim().toLowerCase());
    if (predRecords.length === 0) continue;

    const template = predRecords[0]!;
    for (const r of predRecords) {
      if (!METRICS_TO_COPY.has(r.metric)) continue;
      // 선행 모델의 releaseDate는 후속 모델의 릴리스가 아니므로 옮기지 않는다(릴리스 판정에서 구 릴리스로 지워지지 않게).
      const { releaseDate: _predecessorRelease, ...metadata } = r.metadata ?? {};
      result.push({ ...r, modelId: rule.successor,
        metadata: { ...metadata, successorOf: rule.predecessor, indexBasis: 'predecessor-floor' } });
    }

    const regPrice = findRegularRate(rule.successor);
    if (regPrice) {
      result.push(makePriceRecord(template, rule.successor, 'price_1m_input_tokens', regPrice.input, regPrice.sourceUrl, regPrice.checkedOn, rule.predecessor));
      result.push(makePriceRecord(template, rule.successor, 'price_1m_output_tokens', regPrice.output, regPrice.sourceUrl, regPrice.checkedOn, rule.predecessor));
    }
  }

  return result;
}
