import { NodeHttpClient, type HttpClient } from '../infra/http-client.js';
import { fetchJson } from './fetch-json.js';
import { parseArenaCodingRow } from './arena-coding-parser.js';
import type { ArenaCodingSubset, ParsedArenaCodingModel } from './arena-coding-types.js';

export const ARENA_HF_ENDPOINT = 'https://datasets-server.huggingface.co/rows';
export const ARENA_HF_DATASET = 'lmarena-ai/leaderboard-dataset';
export const DEFAULT_PAGE_LENGTH = 100;
export const DEFAULT_USER_AGENT = 'yoroi-insights/1.0';

export interface ArenaFetchOptions {
  readonly client?: HttpClient;
  readonly fetcher?: (url: string) => Promise<unknown>;
  readonly endpoint?: string;
  readonly dataset?: string;
  readonly split?: string;
  readonly pageLength?: number;
  readonly maxPages?: number;
  readonly maxRows?: number;
  readonly userAgent?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface ArenaFetchResult {
  readonly subset: ArenaCodingSubset;
  readonly rows: readonly ParsedArenaCodingModel[];
  readonly total?: number;
  readonly pages: number;
  readonly partial: boolean;
  readonly status: 'ok' | 'partial' | 'error';
  readonly error?: string;
}

export function buildArenaRowsUrl(params: {
  dataset?: string | undefined; config: string; split?: string | undefined;
  offset: number; length: number; endpoint?: string | undefined;
}): string {
  const url = new URL(params.endpoint ?? ARENA_HF_ENDPOINT);
  url.searchParams.set('dataset', params.dataset ?? ARENA_HF_DATASET);
  url.searchParams.set('config', params.config);
  url.searchParams.set('split', params.split ?? 'latest');
  url.searchParams.set('offset', String(params.offset));
  url.searchParams.set('length', String(params.length));
  return url.toString();
}

async function getJson(url: string, opts: ArenaFetchOptions): Promise<unknown> {
  if (opts.fetcher) return opts.fetcher(url);
  const client = opts.client ?? new NodeHttpClient();
  return fetchJson(client, {
    url, timeoutMs: opts.timeoutMs ?? 10000,
    headers: { 'User-Agent': opts.userAgent ?? DEFAULT_USER_AGENT },
  }, opts.signal);
}

export async function fetchArenaCodingSubset(subset: ArenaCodingSubset, opts: ArenaFetchOptions = {}): Promise<ArenaFetchResult> {
  const length = opts.pageLength ?? DEFAULT_PAGE_LENGTH, maxPages = opts.maxPages ?? 20, maxRows = opts.maxRows ?? 2000;
  const dataset = opts.dataset ?? ARENA_HF_DATASET, split = opts.split ?? 'latest';
  const collected: ParsedArenaCodingModel[] = [], seenIndices = new Set<number>();
  let offset = 0, pages = 0, total: number | undefined, partial = false, error: string | undefined;

  while (pages < maxPages && collected.length < maxRows) {
    const url = buildArenaRowsUrl({ endpoint: opts.endpoint, dataset, config: subset, split, offset, length: Math.min(length, maxRows - collected.length) });
    let data: unknown;
    try { data = await getJson(url, opts); } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      if (pages === 0) return { subset, rows: [], pages: 0, partial: false, status: 'error', error };
      partial = true; break;
    }
    pages += 1;
    const payload = (typeof data === 'object' && data !== null) ? (data as Record<string, unknown>) : null;
    const rowsArray = Array.isArray(payload?.rows) ? payload!.rows : null;
    if (!rowsArray) {
      error = 'Malformed response: rows is not an array';
      if (pages === 1) return { subset, rows: [], pages: 0, partial: false, status: 'error', error };
      partial = true; break;
    }
    if (typeof payload?.num_rows_total === 'number') total = payload.num_rows_total;
    if (payload?.partial === true) partial = true;
    for (const item of rowsArray) {
      if (collected.length >= maxRows) break;
      const idx = (typeof item === 'object' && item !== null && typeof (item as { row_idx?: unknown }).row_idx === 'number')
        ? (item as { row_idx: number }).row_idx : undefined;
      if (idx !== undefined && seenIndices.has(idx)) continue;
      if (idx !== undefined) seenIndices.add(idx);
      const row = (item && typeof item === 'object' && 'row' in item) ? (item as { row: unknown }).row : item;
      const parsed = parseArenaCodingRow(row, subset);
      if (parsed !== undefined) collected.push(parsed);
    }
    offset += rowsArray.length;
    if (rowsArray.length === 0 || (total !== undefined && offset >= total)) break;
    if (rowsArray.length < length) { if (total !== undefined && offset < total) partial = true; break; }
  }
  if (total !== undefined && offset < total) partial = true;
  return { subset, rows: collected, ...(total !== undefined && { total }), pages, partial, status: partial ? 'partial' : 'ok', ...(error && { error }) };
}
