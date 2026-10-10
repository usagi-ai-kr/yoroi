import { SourceError } from '../app/usage-source.js';
import type { HttpClient } from '../infra/http-client.js';
import { parseAaResponse } from './aa-parser.js';
import { parseCognitionResponse } from './cognition-parser.js';
import { fetchJson, type JsonFetchSpec } from './fetch-json.js';
import { parseOpenRouterResponse } from './openrouter-parser.js';
import type { InsightSource } from './record.js';
import type { InsightSourcePort } from './source-port.js';
import type { ParseRowResult } from './parse-utils.js';

type AuthKind = 'x-api-key' | 'bearer' | 'none';

/** One registered 0.4.0 source (#70). OpenCode Data and Vals AI stay excluded. */
export interface InsightSourceEntry {
  readonly id: InsightSource;
  readonly displayName: string;
  /** Access URL form. Arena defines the HF dataset URL only (parquet is a follow-up). */
  readonly url: string;
  readonly pipeline: 'http-json' | 'hf-parquet-deferred';
  readonly auth: AuthKind;
  /** Candidate env var name (docs/insights/sources-a.md, #79); user .env key name unconfirmed. */
  readonly authEnvName: string | null;
  readonly timeoutMs: number;
  readonly license: string | null;
  readonly note: string;
}

export const INSIGHT_SOURCES: readonly InsightSourceEntry[] = [
  { id: 'arena', displayName: 'lmarena-ai LMArena Leaderboard Dataset',
    url: 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset',
    pipeline: 'hf-parquet-deferred', auth: 'none', authEnvName: null, timeoutMs: 20000,
    license: 'CC-BY-4.0', note: 'HF dataset URL only; parquet row pipeline is a follow-up' },
  { id: 'artificial-analysis', displayName: 'Artificial Analysis',
    url: 'https://artificialanalysis.ai/api/v2/language/models/free',
    pipeline: 'http-json', auth: 'x-api-key', authEnvName: 'YOROI_AA_API_KEY', timeoutMs: 10000,
    license: null, note: 'V2 free tier; attribution required' },
  { id: 'openrouter', displayName: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/datasets/rankings-daily?period=day',
    pipeline: 'http-json', auth: 'bearer', authEnvName: 'YOROI_OPENROUTER_API_KEY', timeoutMs: 10000,
    license: 'CC-BY-4.0', note: 'Daily unfiltered dataset; CC BY 4.0 redistribution' },
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

/** Builds one port per registered source from an injected HttpClient and env lookup.
 * Key values come from env only and are never logged; Arena stays deferred. */
export function createInsightSourcePorts(client: HttpClient, env: EnvLookup):
  readonly InsightSourcePort[] {
  return INSIGHT_SOURCES.map(entry => ({
    id: entry.id,
    async fetch(signal?: AbortSignal): Promise<unknown> {
      if (entry.pipeline === 'hf-parquet-deferred') throw new SourceError('unavailable');
      const headers = authHeaders(entry, env);
      const spec: JsonFetchSpec = { url: entry.url, timeoutMs: entry.timeoutMs,
        ...(headers !== undefined ? { headers } : {}) };
      return fetchJson(client, spec, signal);
    },
    parse(payload: unknown, observedAt: string): readonly ParseRowResult[] {
      switch (entry.id) {
        case 'artificial-analysis': return parseAaResponse(payload, observedAt);
        case 'openrouter': return parseOpenRouterResponse(payload, observedAt);
        case 'cognition': return parseCognitionResponse(payload, observedAt);
        default: throw new SourceError('parse');
      }
    },
  }));
}
