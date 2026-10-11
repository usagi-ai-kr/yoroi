import { SourceError, type SourceErrorCode } from '../app/usage-source.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../infra/http-client.js';
import { decideRequest, decideRetry, type RequestPolicy, type RequestState } from './request-policy.js';

/** JSON request description. Header values may hold credentials and are never logged. */
export interface JsonFetchSpec {
  readonly url: string; readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>; readonly timeoutMs: number;
}

/** 소스별로 하나만 유지하는 요청·재시도 상태(H1 계약). 카운터는 전송 직전에 증가한다. */
export interface SourceRequestSession {
  readonly startedAtMs: number; requestsMade: number; retriesMade: number;
}
export interface PolicyFetchOptions {
  readonly policy?: Partial<RequestPolicy>; readonly now?: () => number;
  readonly sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

type Outcome = { readonly ok: true; readonly value: unknown } |
  { readonly ok: false; readonly error: SourceError; readonly retryable: boolean; readonly retryAfter?: string };

/** 일시적 전송 실패만 재시도 대상. cancelled·authentication·parse는 즉시 종료한다. */
const RETRYABLE_CODES: ReadonlySet<SourceErrorCode> = new Set<SourceErrorCode>(['timeout', 'network', 'unavailable']);

/** 대소문자 무관 헤더 조회. 값은 정책 계산에만 쓰고 노출하지 않는다. */
function headerValue(headers: Readonly<Record<string, string>>, name: string): string | undefined {
  const key = Object.keys(headers).find(k => k.toLowerCase() === name);
  return key === undefined ? undefined : headers[key]; }

/** 429는 재시도 가능(+Retry-After), 5xx는 재시도 가능, 401/403은 인증, 그 외 비2xx는 unavailable. */
function statusOutcome(response: HttpResponse): Outcome {
  const { status } = response;
  const denied = { ok: false as const, retryable: false, error: new SourceError('unavailable') };
  if (status === 401 || status === 403) return { ...denied, error: new SourceError('authentication') };
  if (status === 429) { const retryAfter = headerValue(response.headers, 'retry-after');
    return { ...denied, retryable: true, ...(retryAfter !== undefined && { retryAfter }) }; }
  if (status >= 500) return { ...denied, retryable: true };
  return denied;
}

async function attempt(client: HttpClient, spec: JsonFetchSpec, timeoutMs: number, signal?: AbortSignal): Promise<Outcome> {
  const request: HttpRequest = { method: spec.method ?? 'GET', url: spec.url, timeoutMs,
    ...(spec.headers !== undefined ? { headers: { ...spec.headers } } : {}) };
  try {
    const response = await client.request(request, signal);
    if (response.status < 200 || response.status >= 300) return statusOutcome(response);
    try { return { ok: true, value: JSON.parse(response.body) as unknown }; }
    catch { return { ok: false, retryable: false, error: new SourceError('parse') }; }
  } catch (error) {
    if (error instanceof SourceError) return { ok: false, error, retryable: RETRYABLE_CODES.has(error.code) };
    return { ok: false, retryable: false, error: new SourceError('unavailable') };
  }
}

function timerSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return void reject(new SourceError('cancelled'));
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(new SourceError('cancelled')); };
    const timer = setTimeout(finish, milliseconds);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

const state = (session: SourceRequestSession, nowMs: number): RequestState => ({ startedAtMs: session.startedAtMs,
  nowMs, requestsMade: session.requestsMade, retriesMade: session.retriesMade });
/** 정책 사유는 고정 문구로 바꾼다(예산·상한 값 비노출). */
const policyError = (reason: string): SourceError =>
  new SourceError(reason === 'cancelled' ? 'cancelled' : 'unavailable');

/** 정책 없이 한 번만 요청한다(기존 호출부 계약 유지). spec.timeoutMs도 그대로 쓴다. */
export async function fetchJson(client: HttpClient, spec: JsonFetchSpec,
  signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw new SourceError('cancelled');
  const outcome = await attempt(client, spec, spec.timeoutMs, signal);
  if (outcome.ok) return outcome.value;
  throw outcome.error;
}

/** request-policy(H1)를 JSON 요청에 연결한다. 상태는 소스별로 하나만 유지한다. */
export async function fetchJsonWithPolicy(client: HttpClient, spec: JsonFetchSpec,
  session: SourceRequestSession, options: PolicyFetchOptions = {}, signal?: AbortSignal): Promise<unknown> {
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? timerSleep;
  for (;;) {
    if (signal?.aborted) throw new SourceError('cancelled');
    const gate = decideRequest(state(session, now()), options.policy);
    if (!gate.allowed) throw policyError(gate.reason);
    session.requestsMade += 1;
    const outcome = await attempt(client, spec, Math.min(spec.timeoutMs, gate.timeoutMs), signal); // 타임아웃 제한
    if (outcome.ok) return outcome.value;
    const retry = decideRetry({ ...state(session, now()), retryable: outcome.retryable,
      ...(outcome.retryAfter !== undefined && { retryAfter: outcome.retryAfter }) }, options.policy);
    if (!retry.allowed) throw outcome.error;
    await sleep(retry.waitMs, signal);
    session.retriesMade += 1;
  }
}
