import assert from 'node:assert/strict';
import test from 'node:test';
const moduleURL = new URL('../integrations/opencode-v2/yoroi/signals.js', import.meta.url).href;
const { isFreeId, freeScope, limitError, shouldRecord } = await import(moduleURL) as
  { isFreeId: (id: unknown) => boolean; freeScope: (model: unknown) => boolean;
    limitError: (error: unknown, freeConfirmed?: boolean) => boolean; shouldRecord: (model: unknown, error: unknown) => boolean };
const FREE = { providerID: 'opencode', id: 'grok-code' }, FREE2 = { providerID: 'opencode', id: 'exo-free' };
const PAID = { providerID: 'opencode', id: 'grok-4-6' }, OTHER = { providerID: 'anthropic', id: 'claude-sonnet-4-5' };

test('isFreeId/freeScope: 명시 목록·-free 접미사·provider opencode', () => {
  assert.equal(isFreeId('grok-code'), true); assert.equal(isFreeId('exo-free'), true);
  assert.equal(isFreeId('grok-4-6'), false); assert.equal(freeScope(FREE), true);
  assert.equal(freeScope(PAID), false); assert.equal(freeScope(OTHER), false);
});

test('limitError: usage limit type·Free usage exceeded·free 확인 Rate limit exceeded만 true', () => {
  assert.equal(limitError({ type: 'usage_limit', message: 'Free usage exceeded' }), true);
  assert.equal(limitError({ message: 'Free usage exceeded, retrying in 2h' }), true);
  assert.equal(limitError({ message: 'Rate limit exceeded. Please try again later.' }, true), true);
  assert.equal(limitError({ message: 'Rate limit exceeded. Please try again later.' }, false), false);
  assert.equal(limitError({ type: 'provider.rate-limit', message: 'Upstream request failed: Endpoint is unavailable.' }), false);
  assert.equal(limitError({ status: 429, message: 'Too many requests' }), false);
});

test('shouldRecord: quota 표식만 true, 429 단독·upstream·표식 없는 429는 false', () => {
  assert.equal(shouldRecord(FREE, { status: 429 }), false, '429 단독 무기록(신규)');
  assert.equal(shouldRecord(FREE, { status: 429, type: 'provider.rate-limit', message: 'Upstream request failed: Endpoint is unavailable.' }), false, 'upstream 무기록');
  assert.equal(shouldRecord(FREE, { status: 429, message: 'Too many requests' }), false, '표식 없는 429 무기록');
  assert.equal(shouldRecord(FREE, { status: 429, type: 'usage_limit', message: 'Free usage exceeded' }), true, 'quota 429 기록');
  assert.equal(shouldRecord(FREE, { message: 'Rate limit exceeded. Please try again later.' }), true, 'free 확인 Rate limit exceeded 기록');
  assert.equal(shouldRecord(PAID, { message: 'Free usage exceeded' }), true, 'quota 표식은 모델 무관');
  assert.equal(shouldRecord(OTHER, { message: 'Free usage exceeded' }), true, 'quota 표식은 공급자 무관');
});

test('통합 시나리오: 일시 429→exceeded 없음, quota 429→exceeded, 2xx+timeout+completed→ok 1회', async () => {
  const { createPlugin } = await import(new URL('../integrations/opencode-v2/yoroi-zen-free.js', import.meta.url).href) as { createPlugin: (o: Record<string, unknown>) => any };
  const calls: string[][] = [];
  const handlers = new Map<string, (e: unknown) => void>();
  const plugin = createPlugin({ report: async (a: string[]) => { calls.push(a); return true; }, now: () => Date.parse('2026-10-13T00:00:00Z') });
  plugin.setup({ session: { hook: (n: string, h: (e: unknown) => void) => { handlers.set(n, h); return { dispose: () => {} }; } } });
  const emit = (n: string, e: unknown) => handlers.get(n)!(e);
  emit('context', { sessionID: 'ses_1', model: FREE });
  emit('retry', { sessionID: 'ses_1', model: FREE, error: { status: 429, type: 'provider.rate-limit', message: 'Upstream request failed: Endpoint is unavailable.' } });
  assert.equal(calls.filter(c => c[0] === '--exceeded').length, 0, '일시 429 무기록');
  emit('retry', { sessionID: 'ses_1', model: FREE, error: { status: 429, message: 'Free usage exceeded' } });
  assert.equal(calls.filter(c => c[0] === '--exceeded').length, 1, 'quota 429 기록');
  const release = (await import(new URL('../integrations/opencode-v2/yoroi/release.js', import.meta.url).href) as any).createRelease;
  const rcalls: string[][] = [];
  const r = release({ report: async (a: string[]) => { rcalls.push(a); return true; }, ctx: { session: { wait: () => new Promise(() => {}), context: () => Promise.resolve([{ type: 'user', time: { created: 0 } }, { type: 'assistant', time: { created: 1, completed: 2 }, finish: 'stop', model: FREE }]) } }, timeoutMs: 5 });
  r.onResponse({ sessionID: 'ses_2', kind: 'primary', model: FREE, response: { status: 200 } });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(rcalls, [['--ok', '--model', 'grok-code']]);
});
