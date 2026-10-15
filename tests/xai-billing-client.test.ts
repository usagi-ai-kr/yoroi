import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { SourceError, type SourceErrorCode } from '../src/app/usage-source.js';
import { NodeHttpClient } from '../src/infra/http-client.js';
import { XAI_BILLING_URL, XaiBillingClient } from '../src/infra/xai-billing-client.js';

const fixture = await readFile(new URL('./fixtures/xai-billing-weekly.json', import.meta.url), 'utf8');
const observedAt = '2026-10-15T00:00:00Z';
const okAuth = () => ({ token: 'synthetic-token' });
const failAuth = (): { token: string } => { throw new SourceError('authentication'); };
const source = (fetcher: typeof fetch, auth = okAuth, timeoutMs = 500) =>
  new XaiBillingClient(new NodeHttpClient(fetcher), auth, timeoutMs, () => observedAt);
const expectCode = (run: () => Promise<unknown>, code: SourceErrorCode) =>
  assert.rejects(run(), (error: unknown) => error instanceof SourceError && error.code === code);
const respond = (body: string, status: number) => async () => new Response(body, { status });

test('GET·헤더 4종·주간 창 스냅샷 매핑(합성 fixture, 실호출 없음)', async () => {
  let seenUrl = ''; let seenInit: RequestInit | undefined;
  const snapshot = await source(async (url, init) => {
    seenUrl = String(url); seenInit = init; return new Response(fixture, { status: 200 });
  }).read();
  assert.equal(seenUrl, XAI_BILLING_URL);
  const headers = seenInit?.headers as Record<string, string>;
  assert.deepEqual([headers['Authorization'], headers['X-XAI-Token-Auth'], headers['x-grok-client-version'], headers['Accept']],
    ['Bearer synthetic-token', 'xai-grok-cli', '1.0.0', 'application/json']);
  assert.deepEqual(snapshot, { provider: 'xai', observedAt, windows: [
    { id: 'weekly', unit: 'percent', percent: 42.5, resetAt: '2026-10-20T00:00:00Z', periodStart: '2026-10-13T00:00:00Z' }] });
});

test('상태 매핑: 401/403 authentication · 429/5xx network · 그 외 non-200 unavailable', async () => {
  await expectCode(() => source(respond(fixture, 401)).read(), 'authentication');
  await expectCode(() => source(respond(fixture, 403)).read(), 'authentication');
  await expectCode(() => source(respond(fixture, 429)).read(), 'network');
  await expectCode(() => source(respond(fixture, 503)).read(), 'network');
  await expectCode(() => source(respond(fixture, 404)).read(), 'unavailable');
});

test('본문 JSON 오류·스키마 결손은 parse, 타임아웃은 timeout으로 전파된다', async () => {
  await expectCode(() => source(respond('not-json', 200)).read(), 'parse');
  await expectCode(() => source(respond('{"config":{}}', 200)).read(), 'parse');
  const hanging = (_url: string, init: RequestInit) => new Promise<never>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  });
  await expectCode(() => source(hanging as typeof fetch, okAuth, 5).read(), 'timeout');
});

test('auth 공급자 실패는 authentication으로 전파된다(만료 확인 지점 분리)', async () => {
  await expectCode(() => source(respond(fixture, 200), failAuth).read(), 'authentication');
});
