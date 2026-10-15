import assert from 'node:assert/strict';
import test from 'node:test';

const moduleURL = new URL('../integrations/opencode-v2/yoroi/release.js', import.meta.url).href;
const { createRelease, SETTLE_TIMEOUT_MS } = await import(moduleURL) as
  { createRelease: (options: Record<string, unknown>) => any; SETTLE_TIMEOUT_MS: number };

const SESSION = 'ses_test';
const FREE = Object.freeze({ providerID: 'opencode', id: 'big-pickle' });
const response200 = () => ({ status: 200 });
const event = (over: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ sessionID: SESSION, kind: 'primary', model: FREE, response: response200(), ...over });
const assistant = (over: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ type: 'assistant', time: { created: 1, completed: 2 }, finish: 'stop', model: FREE, ...over });
const messages = (value: Record<string, unknown>): unknown[] => [{ type: 'user', time: { created: 0 } }, value];

function harness(options: { wait?: () => Promise<void>; context?: () => Promise<unknown[]>; timeoutMs?: number } = {}) {
  const calls: string[][] = [];
  const release = createRelease({
    report: async (args: string[]) => { calls.push(args); return true; },
    ctx: { session: {
      wait: options.wait ?? (() => Promise.resolve()),
      context: options.context ?? (() => Promise.resolve(messages(assistant()))) } },
    timeoutMs: options.timeoutMs ?? 500,
  });
  return { release, calls };
}
const flush = (ms = 5): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

test('정상 완료: 2xx·primary·opencode free 후보 → wait→context 확인 후 --ok 1회(설계 15s 기본)', async () => {
  assert.equal(SETTLE_TIMEOUT_MS, 15_000);
  const { release, calls } = harness();
  release.onResponse(event());
  await flush();
  assert.deepEqual(calls, [['--ok', '--model', 'big-pickle']]);
  assert.equal(release.settled.size, 1);
});

test('중복 방지: 같은 세션 반복 2xx는 ok 1회만 발행된다', async () => {
  const { release, calls } = harness();
  release.onResponse(event());
  release.onResponse(event());
  await flush();
  release.onResponse(event());
  await flush();
  assert.equal(calls.length, 1);
});

test('wait 타임아웃·예외는 no-clear다', async () => {
  const timed = harness({ wait: () => new Promise<void>(() => {}), timeoutMs: 5 });
  timed.release.onResponse(event());
  await flush(20);
  assert.equal(timed.calls.length, 0);
  const broken = harness({ wait: () => Promise.reject(new Error('boom')) });
  broken.release.onResponse(event());
  await flush();
  assert.equal(broken.calls.length, 0);
});

test('finish length/error·time.completed 부재는 no-clear다', async () => {
  for (const over of [{ finish: 'length' }, { finish: 'error' }, { time: { created: 1 } }]) {
    const { release, calls } = harness({ context: () => Promise.resolve(messages(assistant(over))) });
    release.onResponse(event());
    await flush();
    assert.equal(calls.length, 0, JSON.stringify(over));
  }
});

test('유료·타 공급자·비 primary 200 단독은 후보가 되지 않는다(200 단독 해제 금지)', async () => {
  for (const over of [{ model: { providerID: 'anthropic', id: 'gpt-6-luna' } }, { kind: 'title' }]) {
    const { release, calls } = harness();
    release.onResponse(event(over));
    await flush();
    assert.equal(calls.length, 0, JSON.stringify(over));
  }
});

test('4xx/5xx·모델 불일치는 no-clear다', async () => {
  for (const status of [400, 429, 500]) {
    const { release, calls } = harness();
    release.onResponse(event({ response: { status } }));
    await flush();
    assert.equal(calls.length, 0, String(status));
  }
  const mismatch = harness({ context: () => Promise.resolve(messages(assistant({ model: { providerID: 'opencode', id: 'step-5-preview-free' } }))) });
  mismatch.release.onResponse(event());
  await flush();
  assert.equal(mismatch.calls.length, 0);
});

test('context 예외·형식 오류(배열 아님)도 no-clear다', async () => {
  for (const context of [() => Promise.reject(new Error('read fail')), () => Promise.resolve(undefined as unknown as unknown[])]) {
    const { release, calls } = harness({ context });
    release.onResponse(event());
    await flush();
    assert.equal(calls.length, 0);
  }
});
