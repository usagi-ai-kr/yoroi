import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../src/infra/http-client.js';
import { fetchJson } from '../src/insights/fetch-json.js';
import { collectInsightSource } from '../src/insights/source-port.js';
import { createInsightSourcePorts, INSIGHT_SOURCES } from '../src/insights/sources.js';

const observedAt = '2026-10-10T00:00:00.000Z';
function fakeClient(): { client: HttpClient; requests: HttpRequest[];
  respond: (fn: (request: HttpRequest) => HttpResponse) => void } {
  const requests: HttpRequest[] = [];
  let handler: (request: HttpRequest) => HttpResponse = () => ({ status: 200, headers: {}, body: '{}' });
  const client: HttpClient = { async request(request, signal) {
    requests.push(request);
    if (signal?.aborted) throw new SourceError('cancelled');
    return handler(request);
  } };
  return { client, requests, respond: fn => { handler = fn; } };
}
const env = (name: string): string | undefined =>
  ({ YOROI_AA_API_KEY: 'fake-aa', YOROI_OPENROUTER_API_KEY: 'fake-or' } as Record<string, string>)[name];
const aaPayload = { tier: 'free', intelligence_index_version: 3,
  pagination: { page: 1, page_size: 10, total_pages: 1, has_more: false },
  data: [{ id: 'm1', slug: 'gpt-oss-20b', name: 'GPT-OSS 20B', release_date: '2025-01-01',
    model_creator: { id: 'openai', name: 'OpenAI' },
    evaluations: { artificial_analysis_intelligence_index: 42, artificial_analysis_coding_index: 38 }, pricing: {}, performance: {} }] };
const orPayload = { meta: { as_of: '2026-10-09T00:00:00Z', start_date: '2026-10-01',
  end_date: '2026-10-09', version: 'v1' },
  data: [{ date: '2026-10-09', model_permaslug: 'gpt-5', total_tokens: 123 }] };
const cogPayload = { v1_1: { models: ['M'], subsets: { main: 100 },
  data: { M: { high: { main: { correct: 0.5, cost: 1.25 } } } } } };

test('registry holds the four go sources plus the OpenCode Data internal reference (#102)', () => { assert.deepEqual(INSIGHT_SOURCES.map(e => e.id), ['artificial-analysis', 'openrouter', 'opencode-data', 'cognition', 'arena-coding']);
  const byId = new Map(INSIGHT_SOURCES.map(e => [e.id, e]));
  assert.equal(byId.get('artificial-analysis')?.url, 'https://artificialanalysis.ai/api/v2/language/models/free');
  assert.equal(byId.get('openrouter')?.url, 'https://openrouter.ai/api/v1/datasets/rankings-daily?period=day');
  assert.equal(byId.get('cognition')?.url, 'https://cognition.com/data/frontiercode-leaderboard/data.json');
  assert.deepEqual([...byId].map(([id, e]) => [id, e.pipeline]), [['artificial-analysis', 'aa-pages'], ['openrouter', 'http-json'], ['opencode-data', 'opencode-json'], ['cognition', 'http-json'], ['arena-coding', 'arena-rows']]);
  assert.equal(byId.get('opencode-data')?.displayName, 'OpenCode Data (내부 참조 · 약관상 자동 추출 제한)');
  assert.deepEqual(INSIGHT_SOURCES.filter(e => e.authEnvName !== null).map(e => e.authEnvName), ['YOROI_AA_API_KEY', 'YOROI_OPENROUTER_API_KEY']);
});

test('fetchJson passes spec through and classifies status and body errors', async () => {
  const fake = fakeClient();
  assert.deepEqual(await fetchJson(fake.client, { url: 'https://x.test/a', timeoutMs: 1234 }), {});
  assert.equal(fake.requests[0]?.method, 'GET');
  assert.equal(fake.requests[0]?.url, 'https://x.test/a');
  assert.equal(fake.requests[0]?.timeoutMs, 1234);
  for (const [status, code] of [[429, 'unavailable'], [503, 'unavailable'], [401, 'authentication']] as const) {
    fake.respond(() => ({ status, headers: {}, body: '{}' }));
    await assert.rejects(fetchJson(fake.client, { url: 'https://x.test/a', timeoutMs: 1 }),
      (error: SourceError) => error instanceof SourceError && error.code === code);
  }
  fake.respond(() => ({ status: 200, headers: {}, body: 'not json' }));
  await assert.rejects(fetchJson(fake.client, { url: 'https://x.test/a', timeoutMs: 1 }),
    (error: SourceError) => error instanceof SourceError && error.code === 'parse');
  const aborted = AbortSignal.abort();
  await assert.rejects(fetchJson(fake.client, { url: 'https://x.test/a', timeoutMs: 1 }, aborted),
    (error: SourceError) => error instanceof SourceError && error.code === 'cancelled');
});

test('ports add auth headers from env without leaking keys', async () => {
  const fake = fakeClient();
  fake.respond(() => ({ status: 200, headers: {}, body: '{}' }));
  const ports = new Map(createInsightSourcePorts(fake.client, env).map(p => [p.id, p]));
  await ports.get('artificial-analysis')!.fetch();
  const aa = fake.requests.at(-1)!;
  assert.deepEqual(Object.keys(aa.headers ?? {}), ['x-api-key']);
  await ports.get('openrouter')!.fetch();
  assert.ok((fake.requests.at(-1)!.headers!.Authorization ?? '').startsWith('Bearer '));
  await ports.get('cognition')!.fetch();
  assert.equal(fake.requests.at(-1)!.headers, undefined);
  const noKey = createInsightSourcePorts(fake.client, () => undefined)
    .find(p => p.id === 'artificial-analysis')!;
  await assert.rejects(noKey.fetch(),
    (error: SourceError) => error instanceof SourceError && error.code === 'authentication');
});

test('collectInsightSource wires each parser and returns instead of throwing', async () => {
  const fake = fakeClient();
  const ports = new Map(createInsightSourcePorts(fake.client, env, { sleep: async () => {} }).map(p => [p.id, p]));
  fake.respond(request => ({ status: 200, headers: {},
    body: JSON.stringify(request.url.includes('openrouter') ? orPayload :
      request.url.includes('cognition') ? cogPayload : aaPayload) }));
  for (const id of ['artificial-analysis', 'openrouter', 'cognition'] as const) {
    const result = await collectInsightSource(ports.get(id)!, observedAt);
    assert.equal(result.ok, true);
    if (result.ok) assert.ok(result.rows.every(r => r.ok && r.records.length > 0));
  }
  fake.respond(() => ({ status: 503, headers: {}, body: '{}' }));
  const failed = await collectInsightSource(ports.get('cognition')!, observedAt);
  assert.deepEqual(failed, { ok: false, id: 'cognition', observedAt,
    error: new SourceError('unavailable') });
});
