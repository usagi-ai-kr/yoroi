// yoroi-managed: opencode-zen-free v2
// V2 문서(/v2/docs/build/plugins/) 기준 Plugin.define 모양(default export { id, setup(ctx) })을 따른다.
// `@opencode/plugin` import 해석은 [미문서]이므로 import 없이 같은 모양의 객체를 export한다(실측 후 교체).
// 판정 로직은 yoroi/signals.js로 분리(설치기와 함께 복사) — 진입점은 import로 결합만 한다.
import { execFile } from 'node:child_process';
import { freeScope, shouldRecord } from './yoroi/signals.js';

/** [미문서] 훅 이름·payload 필드 접근을 이 어댑터 한 곳에 모은다 — 실측 후 여기만 교체. */
const ADAPTER = Object.freeze({
  hooks: { retry: 'retry', httpResponse: 'http.response', context: 'context' },
  model: event => {
    const m = event?.model;
    if (typeof m === 'string') return { id: m };
    return typeof m?.id === 'string'
      ? { id: m.id, providerID: typeof m.providerID === 'string' ? m.providerID : undefined } : undefined;
  },
  sessionId: event => (typeof event?.sessionID === 'string' ? event.sessionID : undefined),
  error: event => event?.error,
  response: event => event?.response,
});
const MAX_SESSIONS = 256;
const safeModel = value => typeof value === 'string' && /^[\w.-]{1,128}$/.test(value) ? value : undefined;

function retryAt(data, now) {
  const headers = Object.fromEntries(Object.entries(data?.responseHeaders ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const valid = ms => Number.isFinite(ms) && ms > 0 && ms <= 366 * 86400000;
  for (const key of ['retry-after-ms', 'retry-after']) {
    const raw = headers[key];
    if (typeof raw !== 'string' || raw.length >= 128) continue;
    const ms = /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) * (key === 'retry-after-ms' ? 1 : 1000) :
      key === 'retry-after' ? Date.parse(raw) - now : NaN;
    if (valid(ms)) return new Date(now + ms).toISOString();
  }
  const match = /^Free usage exceeded, retrying in (\d+(?:\.\d+)?)([hms])\s*$/i.exec(typeof data?.message === 'string' ? data.message : '');
  const ms = match ? Number(match[1]) * ({ h: 3600000, m: 60000, s: 1000 }[match[2].toLowerCase()]) : NaN;
  return valid(ms) ? new Date(now + ms).toISOString() : undefined;
}
function headersOf(response) { try { return Object.fromEntries(response.headers.entries()); } catch { return {}; } }

/** 기본 report: V1 runtime.js와 같은 CLI 경로(출처: integrations/opencode/yoroi/runtime.js). */
export function defaultReport(args) {
  return new Promise(resolve => {
    try {
      execFile(process.env.YOROI_BIN || 'yoroi', ['zen-free', 'report', ...args],
        { timeout: 6000, killSignal: 'SIGKILL', maxBuffer: 4096, windowsHide: true }, error => resolve(!error));
    } catch { resolve(false); }
  });
}

export function createPlugin({ report = defaultReport, now = Date.now } = {}) {
  const sessions = new Map();
  const remember = (id, model) => { sessions.delete(id); sessions.set(id, model);
    if (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value); };
  const exceeded = (model, at) => { const id = model && safeModel(model.id);
    void report(['--exceeded', ...(id ? ['--model', id] : []),
      '--reason', 'free_usage_exceeded', ...(at ? ['--retry-at', at] : [])]); };
  return {
    id: 'yoroi-zen-free',
    setup(ctx) {
      void report(['--loaded', '--marker', 'v2']);
      const registrations = [];
      const hook = (name, handler) => { registrations.push(ctx?.session?.hook?.(name, handler)); };
      hook(ADAPTER.hooks.context, event => { const id = ADAPTER.sessionId(event), model = ADAPTER.model(event);
        if (id && model) remember(id, model); });
      hook(ADAPTER.hooks.retry, event => {
        const error = ADAPTER.error(event);
        const id = ADAPTER.sessionId(event);
        const model = ADAPTER.model(event) ?? (id ? sessions.get(id) : undefined);
        if (!shouldRecord(model, error)) return;
        exceeded(model, retryAt({ message: error?.message }, now()));
      });
      hook(ADAPTER.hooks.httpResponse, event => {
        const response = ADAPTER.response(event);
        if (response?.status !== 429) return;
        const id = ADAPTER.sessionId(event);
        const model = id ? sessions.get(id) : undefined;
        if (!freeScope(model)) return; // 미등록·유료·타 공급자 세션의 429는 무기록(리뷰 (a))
        const at = retryAt({ responseHeaders: headersOf(response) }, now());
        if (!at) return;
        exceeded(model, at);
      });
      return () => { for (const registration of registrations) registration?.dispose?.(); };
    },
  };
}
export default createPlugin();
