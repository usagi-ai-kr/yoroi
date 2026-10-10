import assert from 'node:assert/strict';
import test from 'node:test';
const moduleURL = new URL('../integrations/opencode/yoroi/state.js', import.meta.url).href;
const { createHooks } = await import(moduleURL);
const { retryAt } = await import(new URL('../integrations/opencode/yoroi/signals.js', import.meta.url).href);
const message = (id = 'msg_1', extra = {}) => ({ type: 'message.updated', properties: { info: {
  id, sessionID: 'ses_1', providerID: 'opencode', modelID: 'free', role: 'assistant',
  time: { created: 1 }, ...extra } } });
const idle = { type: 'session.idle', properties: { sessionID: 'ses_1' } };
const error = (data = {}, sessionID = 'ses_1') => ({ type: 'session.error', properties: {
  sessionID, error: { name: 'APIError', data: { message: 'Free usage exceeded, retrying in 11h', ...data } } } });
async function setup(report?: (args: string[]) => Promise<boolean>) {
  const calls: string[][] = [];
  const hooks = await createHooks({ loadFreeModels: async () => new Set(['free']),
    report: report ?? (async (args: string[]) => { calls.push(args); return true; }) });
  return { calls, emit: (event: unknown) => hooks.event({ event }) };
}
const completed = { time: { created: 2, completed: 3 }, finish: 'stop' };
test('exceeded uses sanitized args and ISO retry; normal completion unlocks once', async () => {
  const { calls, emit } = await setup();
  await emit(message()); await emit(error()); await emit(error());
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.slice(0, 6), ['--exceeded', '--model', 'free', '--reason', 'free_usage_exceeded', '--retry-at']);
  assert.ok(Number.isFinite(Date.parse(calls[0]?.[6] ?? '')));
  assert.ok(!calls.flat().join(' ').includes('Free usage exceeded'));
  assert.ok(!calls.flat().includes('--retry-in'));
  await emit(message('msg_2', completed));
  await Promise.all([emit(idle), emit(idle), emit(idle)]);
  assert.deepEqual(calls[1], ['--ok', '--model', 'free']);
  assert.equal(calls.length, 2);
  await emit(message('msg_3', { time: { created: 4 } })); await emit(error());
  await emit(message('msg_4', { ...completed, time: { created: 5, completed: 6 } })); await emit(idle);
  assert.equal(calls.length, 4);
});
test('ignores unrelated errors, uncorrelated sessions, paid models and incomplete messages', async () => {
  const { calls, emit } = await setup();
  await emit(error()); await emit(message()); await emit(error({}, 'other'));
  await emit(error({ message: 'Network error', statusCode: 429 }));
  await emit(message('msg_2', { ...completed, providerID: 'other' })); await emit(error()); await emit(idle);
  await emit(message('msg_3', { ...completed, modelID: 'unknown-free' })); await emit(idle);
  assert.equal(calls.length, 0);
});
test('retry action reports once; later error enriches retry time exactly once', async () => {
  const { calls, emit } = await setup(); await emit(message());
  const retry = { type: 'session.status', properties: { sessionID: 'ses_1', status: {
    type: 'retry', next: Date.now() + 1000, action: { reason: 'free_tier_limit', provider: 'opencode' } } } };
  await emit(retry); await emit(retry);
  assert.equal(calls.length, 1); assert.ok(!calls[0]?.includes('--retry-at'));
  await emit(message()); await emit(error({ responseHeaders: { 'retry-after': '3600' } }));
  await emit(retry); await emit(error({ responseHeaders: { 'retry-after': '3600' } }));
  assert.equal(calls.length, 2); assert.ok(calls[1]?.includes('--retry-at'));
  assert.ok(Number.isFinite(Date.parse(calls[1]?.at(-1) ?? '')));
  await emit(message('msg_2', completed)); await emit(idle);
  assert.deepEqual(calls[2], ['--ok', '--model', 'free']);
});
test('late errors and tool finishes never clear; reporting failures stay contained and retryable', async () => {
  let attempts = 0;
  const { emit } = await setup(async () => { attempts++; if (attempts === 1) throw Error('fake'); return true; });
  await emit(message('msg_1', completed)); await emit(idle); await emit(idle); await emit(idle);
  assert.equal(attempts, 2);
  const other = await setup();
  await other.emit(message('msg_1', completed)); await other.emit(error({ message: 'Network error' }));
  await other.emit(idle);
  await other.emit(message('msg_2', { ...completed, finish: 'tool-calls' })); await other.emit(idle);
  assert.equal(other.calls.length, 0);
  const broken = await createHooks({ loadFreeModels: async () => { throw Error('fake'); }, report: async () => false });
  for (const input of [null, undefined, false, 1, 'bad', {}, { get event() { throw Error('fake'); } }]) {
    let result: Promise<void> | undefined; assert.doesNotThrow(() => { result = broken.event(input); }); await result;
  }
  await broken.event({ event: message('msg_1', completed) }); await broken.event({ event: idle });
});
test('bounded body detection, retry units and headers reject unrelated typed errors', async () => {
  const { calls, emit } = await setup(); await emit(message());
  await emit(error({ responseBody: JSON.stringify({ error: { type: 'GoUsageLimitError' } }) }));
  assert.equal(calls.length, 0);
  await emit(error({ message: 'rate limited', responseBody: JSON.stringify({ error: { type: 'FreeUsageLimitError' } }),
    responseHeaders: { 'retry-after': '60' } })); assert.equal(calls.length, 1);
  assert.equal(retryAt({ message: 'Free usage exceeded, retrying in 11h' }, 0), '1970-01-01T11:00:00.000Z');
  assert.equal(retryAt({ responseHeaders: { 'retry-after-ms': '1500' } }, 0), '1970-01-01T00:00:01.500Z');
  assert.equal(retryAt({ responseHeaders: { 'retry-after': 'garbage' } }, 0), undefined);
  for (const invalid of ['garbage', '0', '-1', 'Infinity', '999999999999999999999']) {
    assert.equal(retryAt({ responseHeaders: { 'Retry-After-Ms': invalid, 'ReTrY-AfTeR': '60' } }, 0), '1970-01-01T00:01:00.000Z');
    assert.equal(retryAt({ responseHeaders: { 'retry-after-ms': invalid, 'retry-after': 'bad' }, message: 'Free usage exceeded, retrying in 11h' }, 0), '1970-01-01T11:00:00.000Z');
  }
  assert.equal(retryAt({ responseHeaders: { 'Retry-After': 'Thu, 01 Jan 1970 01:00:00 GMT' } }, 0), '1970-01-01T01:00:00.000Z');
});
test('missing cache and failed/empty reload recover after five minutes and report ok once', async () => {
  for (const failure of ['empty', 'throw']) {
    let time = 0; let reads = 0; let created = false; const calls: string[][] = [];
    const hooks = await createHooks({ now: () => time, loadFreeModels: async () => {
      reads++; if (reads === 2 && failure === 'throw') throw Error('fake'); return new Set(created ? ['free'] : []);
    }, report: async (args: string[]) => { calls.push(args); return true; } });
    await hooks.event({ event: message('msg_1', completed) }); await hooks.event({ event: idle });
    assert.equal(reads, 2); assert.equal(calls.length, 0);
    created = true; time = 299999; await hooks.event({ event: idle }); assert.equal(reads, 2);
    time = 300000; await hooks.event({ event: idle }); assert.equal(reads, 3);
    time = 900000; for (let i = 0; i < 5; i++) await hooks.event({ event: idle });
    assert.equal(reads, 3); assert.deepEqual(calls, [['--ok', '--model', 'free']]);
  }
});
