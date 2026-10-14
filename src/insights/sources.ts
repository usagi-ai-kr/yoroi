import { SourceError } from '../app/usage-source.js';
import type { HttpClient } from '../infra/http-client.js';
import { parseCognitionResponse } from './cognition-parser.js';
import { fetchJsonWithPolicy, type JsonFetchSpec, type PolicyFetchOptions, type SourceRequestSession } from './fetch-json.js';
import { parseOpenRouterResponse } from './openrouter-parser.js';
import type { InsightSource } from './record.js';
import type { InsightSourcePort } from './source-port.js';
import { fetchAaPages, parseAaPages } from './sources-aa.js';
import { fetchOpenCodeData, OPEN_CODE_DATA_URL, OPEN_CODE_DATA_ATTRIBUTION, type OpenCodeDataPage, type OpenCodeDataTransport } from './sources-opencode-data.js';
import { emitOpenCodeDataSchemaDiagnostic, parseOpenCodeDataJson } from './opencode-data-json-parser.js';
import type { ParseRowResult } from './parse-utils.js';

type AuthKind = 'x-api-key' | 'bearer' | 'none';

/** One registered source per #70 plus OpenCode Data 내부 참조(#102). Vals AI stays excluded. */
export interface InsightSourceEntry {
  readonly id: InsightSource;
  readonly displayName: string;
  /** Access URL (attribution). */
  readonly url: string;
  readonly pipeline: 'http-json' | 'aa-pages' | 'opencode-json';
  readonly auth: AuthKind;
  /** Candidate env var name (docs/insights/sources-a.md, #79); user .env key name unconfirmed. */
  readonly authEnvName: string | null;
  readonly timeoutMs: number;
  readonly license: string | null;
  readonly note: string;
}

export const INSIGHT_SOURCES: readonly InsightSourceEntry[] = [
  { id: 'artificial-analysis', displayName: 'Artificial Analysis',
    url: 'https://artificialanalysis.ai/api/v2/language/models/free',
    pipeline: 'aa-pages', auth: 'x-api-key', authEnvName: 'YOROI_AA_API_KEY', timeoutMs: 10000,
    license: null, note: 'V2 free tier; attribution required' },
  { id: 'openrouter', displayName: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/datasets/rankings-daily?period=day',
    pipeline: 'http-json', auth: 'bearer', authEnvName: 'YOROI_OPENROUTER_API_KEY', timeoutMs: 10000,
    license: 'CC-BY-4.0', note: 'Daily unfiltered dataset; CC BY 4.0 redistribution' },
  { id: 'opencode-data', displayName: OPEN_CODE_DATA_ATTRIBUTION,
    url: OPEN_CODE_DATA_URL, pipeline: 'opencode-json', auth: 'none', authEnvName: null, timeoutMs: 15000,
    license: null, note: '사용자 결정(2026-10-12) 내부 참조 · 1일 1회 · updatedAt 인용 · 차단 시 재시도 0' },
  { id: 'cognition', displayName: 'Cognition FrontierCode',
    url: 'https://cognition.com/data/frontiercode-leaderboard/data.json',
    pipeline: 'http-json', auth: 'none', authEnvName: null, timeoutMs: 15000,
    license: null, note: 'Internal use only; redistribution prohibited' },
];

export type EnvLookup = (name: string) => string | undefined;

function authHeaders(entry: InsightSourceEntry, env: EnvLookup): Record<string, string> | undefined {
  if (entry.authEnvName === null) return undefined;
  const value = env(entry.authEnvName);
  if (value === undefined || !value.trim()) throw new SourceError('authentication');
  return entry.auth === 'x-api-key' ? { 'x-api-key': value } : { Authorization: `Bearer ${value}` };
}

export type InsightPortOptions = PolicyFetchOptions & { readonly opencodeTransport?: OpenCodeDataTransport; readonly opencodeBaseUrl?: string;
  /** Injected stderr sink for source diagnostics (CLI IO contract); defaults to process.stderr. */ readonly onDiagnostic?: (line: string) => void };

/** Builds one port per registered source for ONE execution: every port gets its own request session that starts at
 * the shared run start (creation time), so the per-source 4-A request/time caps count pages and retries together.
 * Key values come from env only and are never logged. */
export function createInsightSourcePorts(client: HttpClient, env: EnvLookup, options: InsightPortOptions = {}):
  readonly InsightSourcePort[] {
  const startedAtMs = (options.now ?? (() => Date.now()))();
  return INSIGHT_SOURCES.map(entry => {
    const session: SourceRequestSession = { startedAtMs, requestsMade: 0, retriesMade: 0 };
    const spec = (): JsonFetchSpec => {
      const headers = authHeaders(entry, env);
      return { url: entry.url, timeoutMs: entry.timeoutMs, ...(headers !== undefined ? { headers } : {}) };
    };
    return {
      id: entry.id,
      async fetch(signal?: AbortSignal): Promise<unknown> {
        switch (entry.pipeline) {
          case 'opencode-json': return fetchOpenCodeData({ ...(signal && { signal }), ...(options.opencodeTransport && { transport: options.opencodeTransport }), ...(options.opencodeBaseUrl && { baseUrl: options.opencodeBaseUrl }) });
          case 'aa-pages': return fetchAaPages(client, spec(), session, options, signal);
          default: return fetchJsonWithPolicy(client, spec(), session, options, signal);
        }
      },
      parse(payload: unknown, observedAt: string): readonly ParseRowResult[] {
        switch (entry.id) {
          case 'artificial-analysis': return parseAaPages(payload, observedAt, options);
          case 'openrouter': return parseOpenRouterResponse(payload, observedAt);
          case 'cognition': return parseCognitionResponse(payload, observedAt);
          case 'opencode-data': { const json = JSON.parse((payload as OpenCodeDataPage).jsonText) as unknown; emitOpenCodeDataSchemaDiagnostic(json, options.onDiagnostic); return parseOpenCodeDataJson(json, observedAt).rows; }
          default: throw new SourceError('parse');
        }
      },
    };
  });
}
