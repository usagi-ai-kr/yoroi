// yoroi-managed: opencode-zen-free v2
// V2 문서(/v2/docs/build/plugins/) 기준 Plugin.define 모양(default export { id, setup(ctx) })을 따른다.
// `@opencode/plugin` import 해석은 [미문서]이므로 import 없이 같은 모양의 객체를 export한다(실측 후 교체).
// V2가 plugins/ 하위 디렉터리를 패키지로 오인할 수 있어 단일 파일로 유지한다(p37 설계).
import { execFile } from 'node:child_process';

/** [미문서] 훅 이름·payload 필드 접근을 이 어댑터 한 곳에 모은다 — 실측 후 여기만 교체. */
const ADAPTER = Object.freeze({
  hooks: { retry: 'retry', httpResponse: 'http.response', context: 'context' },
  model: event => (typeof event?.model === 'string' ? event.model : undefined),
  sessionId: event => (typeof event?.sessionID === 'string' ? event.sessionID : undefined),
  error: event => event?.error,
  response: event => event?.response,
});
const MAX_SESSIONS = 256;
const safeModel = value => typeof value === 'string' && /^[\w.-]{1,128}$/.test(value) ? value : undefined;

// 출처: integrations/opencode/yoroi/signals.js (V1) — 동일 판정/파싱 로직 복사(미문서 필드 어댑터만 위로 분리).
function limitError(error) {
  if (error?.name !== 'APIError') return false;
  const data = error.data;
  try {
    if (typeof data?.responseBody === 'string' && data.responseBody.length <= 65536) {
      const kind = JSON.parse(data.responseBody)?.error?.type;
      if (kind) return kind === 'FreeUsageLimitError';
    }
  } catch {}
  return typeof data?.message === 'string' && data.message.length <= 4096 &&
    /^(?:Free usage exceeded(?:\b|,)|Rate limit exceeded(?:\b|\.|$))/i.test(data.message);
}
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
  const exceeded = (model, at) => { void report(['--exceeded', ...(model ? ['--model', model] : []),
    '--reason', 'free_usage_exceeded', ...(at ? ['--retry-at', at] : [])]); };
  return {
    id: 'yoroi-zen-free',
    setup(ctx) {
      void report(['--loaded', '--marker', 'v2']);
      const registrations = [];
      const hook = (name, handler) => { registrations.push(ctx?.session?.hook?.(name, handler)); };
      hook(ADAPTER.hooks.context, event => { const id = ADAPTER.sessionId(event), model = safeModel(ADAPTER.model(event));
        if (id && model) remember(id, model); });
      hook(ADAPTER.hooks.retry, event => {
        const error = ADAPTER.error(event);
        if (error?.status !== 429 && !limitError(error)) return;
        const id = ADAPTER.sessionId(event);
        const model = safeModel(ADAPTER.model(event)) ?? (id ? sessions.get(id) : undefined);
        exceeded(model, retryAt(error?.data, now()));
      });
      hook(ADAPTER.hooks.httpResponse, event => {
        const response = ADAPTER.response(event);
        if (response?.status !== 429) return;
        const at = retryAt({ responseHeaders: headersOf(response) }, now());
        if (!at) return;
        const id = ADAPTER.sessionId(event);
        exceeded(id ? sessions.get(id) : undefined, at);
      });
      return () => { for (const registration of registrations) registration?.dispose?.(); };
    },
  };
}
export default createPlugin();
