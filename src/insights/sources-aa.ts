import { SourceError } from '../app/usage-source.js';
import type { HttpClient } from '../infra/http-client.js';
import { mergeAaPages, type AaPageInput } from './aa-pages.js';
import { fetchJsonWithPolicy, type PolicyFetchOptions, type SourceRequestSession } from './fetch-json.js';
import type { InsightRecord } from './record.js';
import type { ParseRowResult } from './parse-utils.js';

/** Upper bound on pages we even try to name; the request policy (10 per run) is the real cap. */
const MAX_LISTED_PAGES = 50;
interface AaPageRequest { readonly url: string; readonly headers?: Record<string, string>; readonly timeoutMs: number }

/** Page 1 is the plain URL; later pages add `?page=N` (the paging query parameter is not yet verified against the
 * live API: confirm in the first real run). Every page goes through the policy path with one shared session. */
export async function fetchAaPages(client: HttpClient, request: AaPageRequest, session: SourceRequestSession,
  options: PolicyFetchOptions, signal?: AbortSignal): Promise<readonly AaPageInput[]> {
  const pages: AaPageInput[] = [];
  let total = 1;
  for (let page = 1; page <= total; page += 1) {
    const url = new URL(request.url); if (page > 1) url.searchParams.set('page', String(page));
    try {
      const payload = await fetchJsonWithPolicy(client, { ...request, url: url.toString() }, session, options, signal);
      pages.push({ page, payload });
      const count = (payload as { pagination?: { total_pages?: unknown } } | null)?.pagination?.total_pages;
      if (page === 1 && Number.isSafeInteger(count) && (count as number) > 1) total = Math.min(count as number, MAX_LISTED_PAGES);
    } catch (error) {
      if (page === 1 || (error instanceof SourceError && error.code === 'cancelled')) throw error;
      pages.push({ page, failure: error instanceof SourceError ? error.code : 'error' });
    }
  }
  return pages;
}

export const AA_TOP_N = 50;
/** 조회·표시용 top50 선택기(F 패킷 배정). 저장 경로는 전체 records를 쓰고 이 선택기를 호출하지 않는다. */
export { selectAaValueTop as selectAaTopModels } from './aa-value-top.js';
/** 전체(4페이지 병합) 저장용 request scope. 기존 top50 부분집합 캐시와 구분한다(p5 설계 §1). */
export const AA_FULL_REQUEST_SCOPE = 'aa-v2:free:language-models:all';
/** Merge pages (H3) into per-model rows and keep every valid record; the top-50 cut now lives at report/query time.
 *  거절된 행(ok:false)은 원본 그대로 끝에 함께 반환해 validation의 rejectedRows>0(partial) 판정으로 이어진다(4-A). */
export function parseAaPages(payload: unknown, observedAt: string, options: PolicyFetchOptions): readonly ParseRowResult[] {
  if (!Array.isArray(payload)) throw new SourceError('parse');
  const merged = mergeAaPages(payload as AaPageInput[], { observedAt, ...(options.policy && { policy: options.policy }) });
  if (merged.status === 'failed') throw new SourceError('parse');
  if (merged.status === 'partial') throw new SourceError('unavailable');
  const byModel = new Map<string, InsightRecord[]>();
  for (const record of merged.records) byModel.set(record.modelId, [...(byModel.get(record.modelId) ?? []), record]);
  if (byModel.size === 0) throw new SourceError('parse');
  const grouped = [...byModel.values()].map((records, index) => ({ ok: true as const, index, records, warnings: index === 0 ? merged.warnings : [] }));
  return [...grouped, ...merged.rejected.map((row, index) => ({ ...row, index: grouped.length + index }))];
}
