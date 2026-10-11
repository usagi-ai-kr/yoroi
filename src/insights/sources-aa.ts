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

/** Merge pages (H3) into per-model rows. Incomplete paging is a source failure, never a partial success. */
export function parseAaPages(payload: unknown, observedAt: string, options: PolicyFetchOptions): readonly ParseRowResult[] {
  if (!Array.isArray(payload)) throw new SourceError('parse');
  const merged = mergeAaPages(payload as AaPageInput[], { observedAt, ...(options.policy && { policy: options.policy }) });
  if (merged.status === 'failed') throw new SourceError('parse');
  if (merged.status === 'partial') throw new SourceError('unavailable');
  const byModel = new Map<string, InsightRecord[]>();
  for (const record of merged.records) byModel.set(record.modelId, [...(byModel.get(record.modelId) ?? []), record]);
  if (byModel.size === 0) throw new SourceError('parse');
  return [...byModel.values()].map((records, index) => ({ ok: true as const, index, records, warnings: index === 0 ? merged.warnings : [] }));
}
