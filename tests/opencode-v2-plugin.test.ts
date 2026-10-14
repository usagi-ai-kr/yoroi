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

test('setup이 --loaded --marker v2를 보고하고 정리 함수가 훅 3개를 dispose한다', () => {
  const h = harness();
  assert.equal(h.plugin.id, 'yoroi-zen-free');
  assert.deepEqual(h.calls, [['--loaded', '--marker', 'v2']]);
  assert.deepEqual([...h.disposed], []);
  h.cleanup();
  assert.deepEqual([...h.disposed].sort(), ['context', 'http.response', 'retry']);
});

test('retry 429: context로 매핑된 모델과 함께 --exceeded를 보고한다', () => {
  const h = harness();
  h.emit('context', { sessionID: 'ses_1', model: 'free-model' });
  h.emit('retry', { sessionID: 'ses_1', error: { status: 429 } });
  assert.deepEqual(h.calls[1], ['--exceeded', '--model', 'free-model', '--reason', 'free_usage_exceeded']);
});

test('V1형 FreeUsageLimitError·문구는 retry-at ISO로, 무관 오류는 무시', () => {
  const h = harness();
  h.emit('retry', { error: { name: 'APIError', data: { message: 'Free usage exceeded, retrying in 2h' } } });
  assert.deepEqual(h.calls[1], ['--exceeded', '--reason', 'free_usage_exceeded',
    '--retry-at', new Date(NOW + 2 * 3600000).toISOString()]);
  h.emit('retry', { error: { name: 'APIError', data: { responseBody: '{"error":{"type":"FreeUsageLimitError"}}' } } });
  assert.equal(h.calls.length, 3); // 헤더·문구가 없으면 retry-at 없이 보고
  h.emit('retry', { error: { name: 'APIError', data: { message: 'Network error' } } });
  h.emit('retry', { error: { status: 500 } });
  assert.equal(h.calls.length, 3);
});

test('http.response 429 + retry-after-ms → --retry-at, 그 외 응답은 무시', () => {
  const h = harness();
  h.emit('http.response', { response: response(429, { 'retry-after-ms': '120000' }) });
  assert.deepEqual(h.calls[1], ['--exceeded', '--reason', 'free_usage_exceeded',
    '--retry-at', new Date(NOW + 120000).toISOString()]);
  h.emit('http.response', { response: response(200, { 'retry-after': '5' }) });
  h.emit('http.response', { response: response(429, {}) });
  assert.equal(h.calls.length, 2);
});

test('context LRU 256: 밀려난 세션은 모델 없이 보고된다', () => {
  const h = harness();
  for (let i = 0; i < 257; i += 1) h.emit('context', { sessionID: `ses_${i}`, model: `m-${i}` });
  h.emit('retry', { sessionID: 'ses_0', error: { status: 429 } });
  h.emit('retry', { sessionID: 'ses_256', error: { status: 429 } });
  assert.deepEqual(h.calls[1], ['--exceeded', '--reason', 'free_usage_exceeded']);
  assert.deepEqual(h.calls[2], ['--exceeded', '--model', 'm-256', '--reason', 'free_usage_exceeded']);
});
