import { PLAN_CATALOG } from './plan-catalog.js';
import { normalizeModelName } from './letter-top10-rank.js';

const PLANS = PLAN_CATALOG.map(plan => ({ planId: plan.planId, planName: plan.planName,
  models: new Set(plan.models.filter(m => m.verified).map(m => normalizeModelName(m.modelId))) }));

/** 후보가 사용자 보유 요금제에서 접근 가능한지 판정한다(정규화 이름 정확 일치).
 *  반환은 플랜 표시명 목록이며, 어디에도 없으면 빈 배열(순위 후보에서 제외). */
export function plansForModel(modelId: string): string[] {
  const norm = normalizeModelName(modelId);
  return PLANS.filter(plan => plan.models.has(norm)).map(plan => plan.planName);
}
