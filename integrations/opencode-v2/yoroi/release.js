// yoroi-managed: opencode-zen-free v2
// 성공 해제 경로(설계 후보A, 2026-10-15): http.response 2xx·kind 'primary'·opencode free 모델 세션에서만 후보 표시 →
// ctx.session.wait({sessionID})를 15s 타임아웃과 경합 → ctx.session.context()의 마지막 assistant가
// time.completed(숫자) 존재·finish==='stop'·model.providerID==='opencode'·free id 일치일 때만
// `zen-free report --ok --model <id>`를 세션당 1회 발행한다.
// no-clear: HTTP 200 단독(비primary·유료·타 공급자)·타임아웃·예외·finish非stop·time.completed 부재·모델 불일치·추정 retryAt 경과.
import { freeScope } from './signals.js';

export const SETTLE_TIMEOUT_MS = 15_000;
const MAX_PENDING = 256;
const MAX_SETTLED = 256;

function lastAssistant(messages) {
  if (!Array.isArray(messages)) return undefined;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.type === 'assistant') return messages[i];
  }
  return undefined;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('wait timeout')), ms);
    Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); });
  });
}

/** report는 'zen-free report' 호출기(주입). ctx는 플러그인 세션 컨텍스트(session.wait·session.context). */
export function createRelease({ report, ctx, timeoutMs = SETTLE_TIMEOUT_MS } = {}) {
  const pending = new Map(); // sessionID -> 후보 modelId
  const settled = new Set(); // sessionID: --ok 발행 완료(중복 방지)
  const settling = new Set(); // sessionID: settle 진행 중(중복 실행 방지)
  const settle = async sessionID => {
    const modelId = pending.get(sessionID);
    if (settled.has(sessionID) || settling.has(sessionID) || !modelId) return;
    settling.add(sessionID);
    try {
      await withTimeout(ctx.session.wait({ sessionID }), timeoutMs);
      const assistant = lastAssistant(await ctx.session.context({ sessionID }));
      if (typeof assistant?.time?.completed !== 'number') return; // 미완료 메시지 no-clear
      if (assistant.finish !== 'stop') return; // length·error 등 no-clear
      const model = assistant.model;
      if (!freeScope(model) || model.id !== modelId) return; // 유료·타 공급자·불일치 no-clear
      if (await report(['--ok', '--model', model.id])) {
        pending.delete(sessionID);
        settled.add(sessionID);
        if (settled.size > MAX_SETTLED) settled.delete(settled.values().next().value); // FIFO 상한(메모리 상한, 동작 유지)
      }
    } catch { /* wait 타임아웃·조회 예외 → no-clear */ }
    finally { settling.delete(sessionID); }
  };
  return {
    pending,
    settled,
    /** http.response 훅 이벤트를 통과시킨다. 2xx·primary·opencode free일 때만 후보 등록 후 settle를 시도한다. */
    onResponse(event) {
      try {
        const response = event?.response;
        if (typeof response?.status !== 'number' || response.status < 200 || response.status >= 300) return;
        if (event?.kind !== 'primary') return;
        const model = event?.model;
        if (!freeScope(model)) return;
        const sessionID = event?.sessionID;
        if (typeof sessionID !== 'string' || settled.has(sessionID)) return;
        pending.set(sessionID, model.id);
        if (pending.size > MAX_PENDING) pending.delete(pending.keys().next().value);
        void settle(sessionID);
      } catch { /* 판정 예외 → 해제하지 않음 */ }
    },
  };
}
