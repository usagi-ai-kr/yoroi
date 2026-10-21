import assert from 'node:assert/strict';
import test from 'node:test';
const moduleURL = new URL('../integrations/opencode-v2/yoroi-zen-free.js', import.meta.url).href;
const { createPlugin } = await import(moduleURL);
const NOW = Date.parse('2026-10-13T00:00:00Z');

function harness() {
  const calls: string[][] = [], disposed: string[] = [];
  const handlers = new Map<string, (event: unknown) => void>();
  const plugin = createPlugin({ report: async (args: string[]) => { calls.push(args); return true; }, now: () => NOW });
  const cleanup = plugin.setup({ session: { hook: (name: string, handler: (event: unknown) => void) => {
    handlers.set(name, handler); return { dispose: () => disposed.push(name) }; } } });
  return { plugin, calls, disposed, cleanup, emit: (name: string, event: unknown) => handlers.get(name)!(event) };
}
const response = (status: number, headers: Record<string, string>) =>
  ({ status, headers: { entries: () => Object.entries(headers)[Symbol.iterator]() } });
// free id 근거: contracts-opencode-zen-free.md:54 — 명시 목록 big-pickle·grok-code + `-free` 접미사(exo-free).
const FREE = { providerID: 'opencode', id: 'grok-code' };
const FREE2 = { providerID: 'opencode', id: 'exo-free' };
const PAID = { providerID: 'opencode', id: 'grok-4-6' };
const OTHER = { providerID: 'anthropic', id: 'claude-sonnet-4-5' };

test('setup이 --loaded --marker v2를 보고하고 정리 함수가 훅 3개를 dispose한다', () => {
  const h = harness();
  assert.equal(h.plugin.id, 'yoroi-zen-free');
  assert.deepEqual(h.calls, [['--loaded', '--marker', 'v2']]);
  h.cleanup();
  assert.deepEqual([...h.disposed].sort(), ['context', 'http.response', 'retry']);
});

test('free 모델 429: quota 표식만 --exceeded 기록, 429 단독은 무기록 (issue #271)', () => {
  const h = harness();
  h.emit('context', { sessionID: 'ses_1', model: FREE });
  h.emit('retry', { sessionID: 'ses_1', model: FREE, error: { status: 429 } });
  h.emit('retry', { sessionID: 'ses_1', model: FREE2, error: { status: 429 } });
  assert.equal(h.calls.length, 1);
  h.emit('retry', { sessionID: 'ses_1', model: FREE, error: { status: 429, type: 'usage_limit', message: 'Free usage exceeded' } });
  assert.deepEqual(h.calls[1], ['--exceeded', '--model', 'grok-code', '--reason', 'free_usage_exceeded']);
  h.emit('retry', { sessionID: 'ses_1', model: FREE2, error: { status: 429, message: 'Free usage exceeded' } });
  assert.deepEqual(h.calls[2], ['--exceeded', '--model', 'exo-free', '--reason', 'free_usage_exceeded']);
});

test('upstream 429과 표식 없는 429는 무기록 (issue #271)', () => {
  const h = harness();
  h.emit('context', { sessionID: 'ses_2', model: PAID });
  h.emit('retry', { sessionID: 'ses_2', model: PAID, error: { status: 429 } });
  h.emit('retry', { sessionID: 'ses_2', model: PAID, error: { status: 429, type: 'provider.rate-limit', message: 'Upstream request failed: Endpoint is unavailable.' } });
  h.emit('retry', { sessionID: 'ses_2', model: PAID, error: { status: 429, message: 'Too many requests' } });
  h.emit('context', { sessionID: 'ses_3', model: PAID });
  h.emit('http.response', { sessionID: 'ses_3', response: response(429, { 'retry-after-ms': '60000' }) });
  assert.equal(h.calls.length, 1);
});

test("문구 세션 한정 (리뷰 b): 'Rate limit exceeded'는 free 세션에서만, 미상 세션은 무기록", () => {
  const h = harness();
  h.emit('retry', { error: { message: 'Rate limit exceeded. Please try again later.' } });
  assert.equal(h.calls.length, 1);
  h.emit('context', { sessionID: 'ses_4', model: FREE });
  h.emit('retry', { sessionID: 'ses_4', error: { message: 'Rate limit exceeded. Please try again later.' } });
  assert.deepEqual(h.calls[1], ['--exceeded', '--model', 'grok-code', '--reason', 'free_usage_exceeded']);
  h.emit('retry', { sessionID: 'ses_4', model: PAID, error: { message: 'Rate limit exceeded. Please try again later.' } });
  assert.equal(h.calls.length, 2);
});

test('명시적 quota 오류: V2 error.type·zen 표식 문구는 모델 무관 기록, V1 shape는 무기록', () => {
  const h = harness();
  h.emit('retry', { error: { type: 'provider.usage-limit', message: 'Free usage exceeded, retrying in 2h' } });
  assert.deepEqual(h.calls[1], ['--exceeded', '--reason', 'free_usage_exceeded',
    '--retry-at', new Date(NOW + 2 * 3600000).toISOString()]);
  h.emit('retry', { error: { name: 'APIError', data: { message: 'Free usage exceeded, retrying in 2h' } } });
  h.emit('retry', { error: { type: 'provider.invalid-request', message: 'bad request' } });
  h.emit('retry', { error: { status: 500 } });
  assert.equal(h.calls.length, 2);
});

test('http.response: free 세션 429+retry-after-ms → --retry-at, 200·헤더 없음·미상 세션 무시', () => {
  const h = harness();
  h.emit('context', { sessionID: 'ses_5', model: FREE });
  h.emit('http.response', { sessionID: 'ses_5', response: response(429, { 'retry-after-ms': '120000' }) });
  assert.deepEqual(h.calls[1], ['--exceeded', '--model', 'grok-code', '--reason', 'free_usage_exceeded',
    '--retry-at', new Date(NOW + 120000).toISOString()]);
  h.emit('http.response', { sessionID: 'ses_5', response: response(200, { 'retry-after': '5' }) });
  h.emit('http.response', { sessionID: 'ses_5', response: response(429, {}) });
  h.emit('http.response', { response: response(429, { 'retry-after-ms': '60000' }) });
  assert.equal(h.calls.length, 2);
});

test('context LRU 256: 밀려난 세션은 무기록, 남은 free 세션은 id로 보고', () => {
  const h = harness();
  for (let i = 0; i < 257; i += 1) h.emit('context', { sessionID: `ses_${i}`, model: { ...FREE, id: `m-${i}-free` } });
  h.emit('retry', { sessionID: 'ses_256', model: { ...FREE, id: 'm-256-free' }, error: { status: 429, type: 'usage_limit', message: 'Free usage exceeded' } });
  h.emit('retry', { sessionID: 'ses_0', error: { status: 429 } }); // 밀려남·이벤트 모델 없음
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.calls[1], ['--exceeded', '--model', 'm-256-free', '--reason', 'free_usage_exceeded']);
});
