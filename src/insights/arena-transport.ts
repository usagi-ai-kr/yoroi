import { SourceError } from '../app/usage-source.js';
import type { HttpClient } from '../infra/http-client.js';
import { parseArenaRows } from './arena-parser.js';
import { fetchJsonWithPolicy, type PolicyFetchOptions } from './fetch-json.js';
import { isIsoDate, isObject, type ParseRowResult } from './parse-utils.js';
import type { RequestPolicy } from './request-policy.js';

/** Confirmed 2026-10-11 (docs/insights/arena-transport.md): HF datasets-server /rows, subset text, category overall. */
export const ARENA_ROWS_URL = 'https://datasets-server.huggingface.co/rows';
export const ARENA_DATASET = 'lmarena-ai/leaderboard-dataset';
export const ARENA_LIMITS = Object.freeze({ config: 'text', split: 'latest', category: 'overall', pageRows: 100,
  maxRows: 600, maxPageChars: 256 * 1024, pageTimeoutMs: 20_000, policy: { maxRequests: 8, budgetMs: 60_000 } });

export interface ArenaFetchOptions extends PolicyFetchOptions {
  readonly signal?: AbortSignal; readonly limits?: Partial<Omit<typeof ARENA_LIMITS, 'policy'>> & { readonly policy?: Partial<RequestPolicy> };
}
export interface ArenaFetchResult {
  /** Raw dataset rows (column names unchanged) for parseArenaRows. */
  readonly rows: readonly unknown[]; readonly totalRows: number; readonly publishDate: string; readonly requests: number;
}
function fail(code: ConstructorParameters<typeof SourceError>[0]): never { throw new SourceError(code); }

/** Reads `latest` overall rows page by page (100 rows, serial) and stops at the first non-overall row. Fails as a
 * whole when the data may be truncated or inconsistent (row cap, request/time budget, partial conversion,
 * total or publish date changing): a cut-off ranking is never returned as success. Anonymous GET, no keys. */
export async function fetchArenaRows(client: HttpClient, options: ArenaFetchOptions = {}): Promise<ArenaFetchResult> {
  const limits = { ...ARENA_LIMITS, ...options.limits };
  const now = options.now ?? (() => Date.now());
  const session = { startedAtMs: now(), requestsMade: 0, retriesMade: 0 };
  const rows: Record<string, unknown>[] = [];
  let total: number | undefined, done = false;
  for (let offset = 0; !done; offset += limits.pageRows) {
    const query = new URLSearchParams({ dataset: ARENA_DATASET, config: limits.config, split: limits.split,
      offset: String(offset), length: String(limits.pageRows) });
    const page = await fetchJsonWithPolicy(client, { url: `${ARENA_ROWS_URL}?${query}`, timeoutMs: limits.pageTimeoutMs },
      session, { ...options, policy: { ...ARENA_LIMITS.policy, ...limits.policy, ...options.policy } }, options.signal);
    if (!isObject(page) || !Array.isArray(page.rows) || page.rows.length > limits.pageRows ||
      !Number.isSafeInteger(page.num_rows_total) || (page.num_rows_total as number) < 0) fail('parse');
    if (page.partial === true || (total !== undefined && total !== page.num_rows_total) ||
      JSON.stringify(page).length > limits.maxPageChars) fail('unavailable');
    total = page.num_rows_total as number;
    for (const entry of page.rows as unknown[]) {
      const row = isObject(entry) ? entry.row : undefined;
      if (!isObject(row) || typeof row.category !== 'string') return fail('parse');
      if (row.category !== limits.category) { done = true; break; }
      if (rows.length >= limits.maxRows) return fail('unavailable');
      rows.push(row);
    }
    if (offset + limits.pageRows >= total || page.rows.length === 0) done = true;
  }
  const dates = new Set(rows.map(row => row.leaderboard_publish_date));
  if (rows.length === 0) fail('parse');
  const [publishDate] = [...dates];
  if (dates.size !== 1 || !isIsoDate(publishDate)) fail('unavailable');
  return { rows, totalRows: total ?? 0, publishDate: publishDate as string, requests: session.requestsMade };
}

/** Transport + existing Arena parser: per-row results for the source port (sources.ts wiring is I0). */
export async function readArena(client: HttpClient, observedAt: string, options: ArenaFetchOptions = {}): Promise<readonly ParseRowResult[]> {
  return parseArenaRows((await fetchArenaRows(client, options)).rows, observedAt);
}
