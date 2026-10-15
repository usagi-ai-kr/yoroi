import assert from 'node:assert/strict';
import test from 'node:test';

const moduleURL = new URL('../integrations/opencode-v2/yoroi/release.js', import.meta.url).href;
const { createRelease } = await import(moduleURL) as { createRelease: (options: Record<string, unknown>) => any };

const FREE = Object.freeze({ providerID: 'opencode', id: 'big-pickle' });
const event = (sessionID: string): Record<string, unknown> =>
  ({ sessionID, kind: 'primary', model: FREE, response: { status: 200 } });
const assistant = (): Record<string, unknown> =>
  ({ type: 'assistant', time: { created: 1, completed: 2 }, finish: 'stop', model: FREE });
const flush = (ms = 10): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

test('report false → 다음 2xx에서 재시도, 성공 후에는 ok가 1회만 발행된다', async () => {
  const calls: string[][] = [];
  let fail = true;
  const release = createRelease({
    report: async (args: string[]) => { calls.push(args); return !fail; },
    ctx: { session: { wait: () => Promise.resolve(), context: () => Promise.resolve([assistant()]) } },
    timeoutMs: 500,
  });
  release.onResponse(event('ses_a'));
  await flush();
  assert.equal(calls.length, 1, '첫 시도는 report false라 미발행');
  assert.equal(release.settled.size, 0, '실패 시 settled 미갱신');
  fail = false;
  release.onResponse(event('ses_a'));
  await flush();
  assert.equal(calls.length, 2, '다음 2xx에서 재시도 1회');
  assert.equal(release.settled.size, 1, '성공 시 settled 갱신');
  release.onResponse(event('ses_a'));
  await flush();
  assert.equal(calls.length, 2, '성공 후 반복 2xx는 무발행(세션당 1회 유지)');
});

test('settled 상한: 256 FIFO 퇴출 + 보유 세션의 ok 1회 동작 유지', async () => {
  const calls: string[][] = [];
  const release = createRelease({
    report: async (args: string[]) => { calls.push(args); return true; },
    ctx: { session: { wait: () => Promise.resolve(), context: () => Promise.resolve([assistant()]) } },
    timeoutMs: 500,
  });
  for (let i = 0; i < 300; i += 1) release.onResponse(event(`ses_${i}`));
  await flush(50);
  assert.equal(calls.length, 300, '세션당 ok 1회씩 발행');
  assert.equal(release.settled.size, 256, 'settled FIFO 상한 256(pending과 동일)');
  assert.equal(release.settled.has('ses_0'), false, '가장 오래된 세션 퇴출(FIFO 순서)');
  assert.equal(release.settled.has('ses_299'), true, '최신 세션 보존');
  release.onResponse(event('ses_299'));
  await flush();
  assert.equal(calls.length, 300, '보유 세션의 반복 2xx는 무발행');
});
