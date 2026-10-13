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
  const bare = barePlan(label);
  return PLAN_SHORT[bare] ?? bare;
}
/** 괄호 괄호 주석(크레딧·한도 등)을 벗긴 플랜 이름만 돌려준다(접근 열 표기). */
export function barePlan(label: string): string {
  return label.replace(/\([^)]*\)/g, '');
}

/** 후보가 사용자 보유 요금제에서 접근 가능한지 판정한다(정규화 이름 정확 일치).
 *  반환은 플랜 이름 목록(괄호 주석 없음 — 레터 접근 열은 이름만 표기)이며, 어디에도 없으면 빈 배열. */
export function plansForModel(modelId: string): string[] {
  const norm = normalizeModelName(modelId);
  return PLANS.flatMap(plan => plan.models.has(norm) ? [plan.planName] : []);
}
