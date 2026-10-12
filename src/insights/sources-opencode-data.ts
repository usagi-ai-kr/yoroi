import ky from 'ky';
import metadata from '../../package.json' with { type: 'json' };
import { SourceError } from '../app/usage-source.js';
import type { InsightHistoryPort, InsightSuccess } from './history-port.js';

/** 사용자 결정(2026-10-12): 내부 전용 참조 수집(위험 수용). 약관상 자동 추출 제한을 존중해
 *  예의 있는 수집만 한다 — 순차 요청·연락처 UA·차단 시 즉시 중단(재시도 0)·하루 1회·원문 미저장. */
export const OPEN_CODE_DATA_URL = 'https://opencode.ai/data/index.json';
export const OPEN_CODE_DATA_SCOPE = 'opencode-data:internal-daily';
export const OPEN_CODE_DATA_SCHEMA = 'opencode-data-v1';
export const OPEN_CODE_DATA_USER_AGENT =
  `yoroi/${metadata.version} (+https://github.com/qus0in/yoroi; internal reference, once daily)`;
export const OPEN_CODE_DATA_ATTRIBUTION = 'OpenCode Data (내부 참조 · 약관상 자동 추출 제한)';
const TIMEOUT_MS = 15000;

export interface OpenCodeDataPage { readonly jsonText: string; readonly requests: 1; readonly statuses: readonly number[] }
export type OpenCodeDataTransport = (url: string, headers: Readonly<Record<string, string>>) => Promise<{ status: number; body: string; contentType?: string }>;
export interface OpenCodeDataOptions { readonly transport?: OpenCodeDataTransport; readonly signal?: AbortSignal; readonly baseUrl?: string }

const kyTransport: OpenCodeDataTransport = async (url, headers) => {
  const response = await ky.get(url, { headers, timeout: TIMEOUT_MS, retry: 0, redirect: 'error', throwHttpErrors: false });
  const contentType = response.headers.get('content-type') ?? undefined;
  return { status: response.status, body: await response.text(), ...(contentType !== undefined && { contentType }) };
};
function assertAllowedStatus(status: number): void {
  if (status === 401 || status === 403) throw new SourceError('authentication');
  if (status === 429 || status >= 500) throw new SourceError('unavailable');
}
/** 200이어도 HTML 챌린지·캡차 페이지면 JSON이 아니므로 우회 없이 즉시 중단한다(재시도 0). */
function isJsonResponse(body: string, contentType: string | undefined): boolean {
  if (body.trimStart().startsWith('<')) return false;
  return contentType === undefined || /json/i.test(contentType);
}

/** 공개 JSON 1회만 요청한다(페이지·두 번째 요청 없음 — 주소는 #80 기록으로 고정, 근거는 docs).
 *  cheerio(HTML 파서)는 구조 확인 전 fallback으로만 남아 있고 운영 흐름에서는 쓰지 않는다. */
export async function fetchOpenCodeData(options: OpenCodeDataOptions = {}): Promise<OpenCodeDataPage> {
  const transport = options.transport ?? kyTransport;
  if (options.signal?.aborted) throw new SourceError('cancelled');
  const url = options.baseUrl ? new URL('/data/index.json', options.baseUrl).toString() : OPEN_CODE_DATA_URL;
  const response = await transport(url, { 'User-Agent': OPEN_CODE_DATA_USER_AGENT });
  assertAllowedStatus(response.status);
  if (!isJsonResponse(response.body, response.contentType)) throw new SourceError('unavailable');
  return { jsonText: response.body, requests: 1, statuses: [response.status] };
}

/** 렌더 소유자(agy1·ollama)가 참고 열에 쓸 수 있는 조회 함수 — 수집은 run-once 담당. */
export function readOpenCodeDataReference(history: InsightHistoryPort, publicationDate: string): InsightSuccess | undefined {
  return history.getDaily({ source: 'opencode-data', publicationDate, requestScope: OPEN_CODE_DATA_SCOPE,
    schemaVersion: OPEN_CODE_DATA_SCHEMA });
}
