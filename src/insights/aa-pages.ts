import { parseAaResponse, type AaRowResult } from './aa-parser.js';
import type { InsightRecord } from './record.js';
import { DEFAULT_REQUEST_POLICY, decideRequest, type RequestPolicy } from './request-policy.js';

/** 4-A 소스별 요청 상한(기본 10). 페이지 요청도 여기에 모두 포함된다. */
export const AA_MAX_PAGES = DEFAULT_REQUEST_POLICY.maxRequests;

export interface AaPageInput {
  /** 1부터 시작하는 요청 페이지 번호. */
  readonly page: number;
  /** 응답 본문. 실패 시 undefined. */
  readonly payload?: unknown;
  /** 실패 사유(비밀 없는 짧은 문자열). */
  readonly failure?: string;
}
export interface AaMergeOptions { readonly observedAt: string; readonly policy?: Partial<RequestPolicy> }
export interface AaMergeResult {
  readonly status: 'ok' | 'partial' | 'failed';
  readonly records: readonly InsightRecord[];
  readonly warnings: readonly string[];
  readonly pagesRequested: number;
  readonly pagesSucceeded: number;
  readonly duplicatesRemoved: number;
  readonly missingPages: readonly number[];
  /** 상한 때문에 이후 페이지를 가져오지 못했는지. */
  readonly truncated: boolean;
}

/** 이미 n건을 보낸 뒤 다음 1건이 4-A 상한 안에 들어가는지 request-policy에 판정만 한다(카운터는 호출자 소유). */
export function pageAllowed(requestsMade: number, policy: Partial<RequestPolicy> = {}): boolean {
  return decideRequest({ startedAtMs: 0, nowMs: 0, requestsMade, retriesMade: 0 }, policy).allowed;
}

/** 중복 적재 키: source·modelId·metric·unit·category·schemaVersion·비교 날짜. */
export function aaRecordKey(record: InsightRecord): string {
  return JSON.stringify([record.source, record.modelId, record.metric, record.unit,
    record.category, record.schemaVersion, record.observedAt]);
}

/** 이미 가져온 페이지 응답만 병합한다. I/O도 키 접근도 하지 않는다. */
export function mergeAaPages(pages: readonly AaPageInput[], options: AaMergeOptions): AaMergeResult {
  const warnings: string[] = [];
  const seen = new Set<number>();
  const keys = new Set<string>();
  const records: InsightRecord[] = [];
  let succeeded = 0, duplicates = 0, truncated = false, skipped = 0;
  for (const input of [...pages].sort((a, b) => a.page - b.page)) {
    if (!Number.isSafeInteger(input.page) || input.page < 1) {
      warnings.push(`Ignored invalid page number: ${String(input.page)}`); continue;
    }
    if (seen.has(input.page)) { warnings.push(`Duplicate page ${input.page} ignored`); continue; }
    // 상한을 넘으면 그 뒤도 전부 탈락이므로 멈춘다(탈락 페이지는 적재하지 않는다).
    if (!pageAllowed(seen.size, options.policy)) {
      truncated = true; skipped += 1; continue;
    }
    seen.add(input.page);
    if (input.failure !== undefined || input.payload === undefined) {
      warnings.push(`Page ${input.page} failed: ${input.failure ?? 'no response'}`); continue;
    }
    let parsed: readonly AaRowResult[];
    try { parsed = parseAaResponse(input.payload, options.observedAt); }
    catch (error) {
      warnings.push(`Page ${input.page} rejected: ${error instanceof Error ? error.message : 'invalid-response'}`); continue;
    }
    succeeded += 1;
    for (const row of parsed) {
      warnings.push(...row.warnings.map(w => `page ${input.page} row ${row.index}: ${w}`));
      for (const record of row.ok ? row.records : []) {
        const key = aaRecordKey(record);
        if (keys.has(key)) { duplicates += 1; continue; }
        keys.add(key); records.push(record);
      }
    }
  }
  const missingPages: number[] = [];
  for (let page = 1, highest = Math.max(0, ...seen); page <= highest; page += 1) {
    if (!seen.has(page)) missingPages.push(page);
  }
  if (missingPages.length) warnings.push(`Missing pages: ${missingPages.join(',')}`);
  const incomplete = truncated || duplicates > 0 || succeeded < seen.size;
  const status: AaMergeResult['status'] = succeeded === 0 ? 'failed'
    : (incomplete || missingPages.length > 0) ? 'partial' : 'ok';
  if (truncated) {
    warnings.push(`Page budget reached: ${AA_MAX_PAGES} requests admitted, ${skipped} page(s) dropped (4-A cap)`);
  }
  if (status === 'failed') warnings.push('Artificial Analysis: every requested page failed');
  if (!records.length) warnings.push('Artificial Analysis: no usable measurements');
  return { status, records, warnings, pagesRequested: seen.size, pagesSucceeded: succeeded,
    duplicatesRemoved: duplicates, missingPages, truncated };
}
