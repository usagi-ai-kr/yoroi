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
const AA_COHORT_METRICS = ['artificial_analysis_coding_index', 'artificial_analysis_intelligence_index'] as const;
/** Top N by coding index UNION top N by intelligence index (ties at each cutoff included), every metric of a
 * selected model kept. Models carrying neither finite score cannot enter either cohort. */
export function selectAaTopModels(records: readonly InsightRecord[], limit = AA_TOP_N): InsightRecord[] {
  const byModel = new Map<string, InsightRecord[]>();
  for (const r of records) byModel.set(r.modelId, [...(byModel.get(r.modelId) ?? []), r]);
  const keep = new Set<string>();
  for (const metric of AA_COHORT_METRICS) {
    const scored = [...byModel.entries()].flatMap(([modelId, modelRecords]) => {
      const record = modelRecords.find(r => r.metric === metric);
      return record && Number.isFinite(record.value) ? [{ modelId, score: record.value }] : [];
    }).sort((a, b) => b.score - a.score);
    const cutoff = scored.length <= limit ? -Infinity : scored[limit - 1]!.score;
    for (const entry of scored) if (entry.score >= cutoff) keep.add(entry.modelId);
  }
  return [...byModel.entries()].flatMap(([modelId, modelRecords]) => keep.has(modelId) ? modelRecords : []);
}

/** Merge pages (H3) into per-model rows, keeping the coding-union-intelligence top 50 (ties included). */
export function parseAaPages(payload: unknown, observedAt: string, options: PolicyFetchOptions): readonly ParseRowResult[] {
  if (!Array.isArray(payload)) throw new SourceError('parse');
  const merged = mergeAaPages(payload as AaPageInput[], { observedAt, ...(options.policy && { policy: options.policy }) });
  if (merged.status === 'failed') throw new SourceError('parse');
  if (merged.status === 'partial') throw new SourceError('unavailable');
  const topRecords = selectAaTopModels(merged.records, AA_TOP_N);
  const byModel = new Map<string, InsightRecord[]>();
  for (const record of topRecords) byModel.set(record.modelId, [...(byModel.get(record.modelId) ?? []), record]);
  if (byModel.size === 0) throw new SourceError('parse');
  return [...byModel.values()].map((records, index) => ({ ok: true as const, index, records, warnings: index === 0 ? merged.warnings : [] }));
}
