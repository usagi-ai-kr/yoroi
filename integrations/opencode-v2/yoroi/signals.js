// yoroi-managed: opencode-zen-free v2
// V2 판정 로직(진입점 yoroi-zen-free.js에서 import). V1 signals.js와 분기: V2 error={type,message,status}, 모델=Model.Ref{providerID,id}.
// 무료 id 근거: docs/contracts-opencode-zen-free.md:54 — `-free` 접미사 + 비접미사 무료 big-pickle·grok-code만 채택.
const FREE_IDS = new Set(['big-pickle', 'grok-code']);

export const isFreeId = id => typeof id === 'string' && (/-free$/i.test(id) || FREE_IDS.has(id));
export const freeScope = model => model?.providerID === 'opencode' && isFreeId(model?.id);

// 명시적 quota 오류(kind·zen 표식 문구)는 모델 무관 수용.
// 'Rate limit exceeded'는 관측 문구이나 opencode free 세션 확인 시에만 신호로 수용한다(리뷰 (b)).
export function limitError(error, freeConfirmed = false) {
  if (typeof error?.type === 'string' && /usage.?limit/i.test(error.type)) return true;
  const message = error?.message;
  if (typeof message !== 'string' || message.length > 4096) return false;
  if (/^Free usage exceeded(?:\b|,)/i.test(message)) return true;
  return freeConfirmed && /^Rate limit exceeded(?:\b|\.|$)/i.test(message);
}

// 429 단독 기록은 opencode free 세션 한정 — 미등록·유료·타 공급자 모델의 429는 무기록(리뷰 (a)).
export function shouldRecord(model, error) {
  return limitError(error, freeScope(model));
}
