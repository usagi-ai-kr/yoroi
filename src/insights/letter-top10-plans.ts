import { PLAN_CATALOG } from './plan-catalog.js';
import { normalizeModelName } from './letter-top10-rank.js';

const PLANS = PLAN_CATALOG.map(plan => ({
  planId: plan.planId,
  planName: plan.planName,
  tier: plan.tier ?? 'paid',
  usagePolicy: plan.usagePolicy,
  models: new Map(plan.models.filter(m => m.verified).map(m => [normalizeModelName(m.modelId), m]))
}));

/** 무료로만 접근 가능한 모델 ID(정규화) 집합: 유료 플랜(tier!=='free')의 비free 항목으로는
 *  접근 불가하고 free 표기 항목(또는 free 플랜)으로만 노리는 모델. 현재 longcat-2-5-preview-free·step-5. */
export function freeOnlyModelIds(): readonly string[] {
  const freeAccess = new Set<string>(), paidAccess = new Set<string>();
  for (const plan of PLANS) for (const [norm, entry] of plan.models) {
    if (entry.free === true || plan.tier === 'free') freeAccess.add(norm);
    else paidAccess.add(norm);
  }
  return [...freeAccess].filter(id => !paidAccess.has(id)).sort();
}

/** 압축 렌더용 요금제 약칭: 괄호 주석(크레딧·한도·풀/정가)을 벗기고 긴 플랜명을 줄인다. */
const PLAN_SHORT: Readonly<Record<string, string>> = {
  'Ollama Cloud Pro': 'Ollama', 'OpenCode Go Plus': 'Go Plus', 'OpenCode Zen Free': 'Zen Free',
  'Antigravity Free': 'Antigravity F', 'OpenCode Go Free': 'Go Free',
};
export function shortPlan(label: string): string {
  const bare = label.replace(/\([^)]*\)/g, '');
  return PLAN_SHORT[bare] ?? bare;
}

/** 후보가 사용자 보유 요금제에서 접근 가능한지 판정한다(정규화 이름 정확 일치).
 *  반환은 플랜 표시명 목록(크레딧/한도/무료·Cursor 과금 방식 표기)이며, 어디에도 없으면 빈 배열(순위 후보에서 제외).
 *  한도 note가 추정(Est.)이면 '·추정'을 붙여 추정 성격을 숨기지 않는다. */
export function plansForModel(modelId: string): string[] {
  const norm = normalizeModelName(modelId);
  return PLANS.flatMap(plan => {
    const entry = plan.models.get(norm);
    if (!entry) return [];
    const base = plan.usagePolicy ? `${plan.planName}(크레딧 ${plan.usagePolicy.credit})` : plan.planName;
    if (entry.free === true) return [`${base}(Free)`];
    if (!entry.usageLimit) return [base];
    const { count, period, note } = entry.usageLimit;
    const estimate = note !== undefined && /est\./i.test(note) ? '·추정' : '';
    return [`${base}(${count}회/${period}${estimate})`];
  });
}
