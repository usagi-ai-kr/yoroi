import { PLAN_CATALOG } from './plan-catalog.js';
import { normalizeModelName } from './letter-top10-rank.js';

const PLANS = PLAN_CATALOG.map(plan => ({
  planId: plan.planId,
  planName: plan.planName,
  usagePolicy: plan.usagePolicy,
  models: new Map(plan.models.filter(m => m.verified).map(m => [normalizeModelName(m.modelId), m]))
}));

/** 후보가 사용자 보유 요금제에서 접근 가능한지 판정한다(정규화 이름 정확 일치).
 *  반환은 플랜 표시명 목록(크레딧/한도 있을 시 병기)이며, 어디에도 없으면 빈 배열(순위 후보에서 제외).
 *  한도 note가 추정(Est.)이면 '·추정'을 붙여 추정 성격을 숨기지 않는다. */
export function plansForModel(modelId: string): string[] {
  const norm = normalizeModelName(modelId);
  return PLANS.flatMap(plan => {
    const entry = plan.models.get(norm);
    if (!entry) return [];
    const base = plan.usagePolicy ? `${plan.planName}(크레딧 ${plan.usagePolicy.credit})` : plan.planName;
    if (!entry.usageLimit) return [base];
    const { count, period, note } = entry.usageLimit;
    const estimate = note !== undefined && /est\./i.test(note) ? '·추정' : '';
    return [`${base}(${count}회/${period}${estimate})`];
  });
}
