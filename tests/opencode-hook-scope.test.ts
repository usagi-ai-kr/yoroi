import assert from 'node:assert/strict';
import test from 'node:test';

const stateURL = new URL('../integrations/opencode/yoroi/state.js', import.meta.url).href;
const { createHooks } = await import(stateURL);

const message = (sessionID: string, modelID: string, id = 'msg_1', extra = {}) => ({
  type: 'message.updated',
  properties: {
    info: {
      id,
      sessionID,
      providerID: 'opencode',
      modelID,
      role: 'assistant',
      time: { created: 1 },
      ...extra,
    },
  },
});

const idle = (sessionID: string) => ({
  type: 'session.idle',
  properties: { sessionID },
});

const limitErr = (sessionID: string) => ({
  type: 'session.error',
  properties: {
    sessionID,
    error: {
      name: 'APIError',
      data: { message: 'Rate limit exceeded' },
    },
  },
});

async function setup() {
  const calls: string[][] = [];
  const hooks = await createHooks({
    loadFreeModels: async () => new Set(['free-a', 'free-b']),
    report: async (args: string[]) => {
      calls.push(args);
      return true;
    },
  });
  return { calls, emit: (event: unknown) => hooks.event({ event }) };
}

test('non-free model rate limit error does not report exceeded', async () => {
  const { calls, emit } = await setup();
  await emit(message('ses_paid', 'paid-model', 'msg_1'));
  await emit(limitErr('ses_paid'));
  assert.equal(calls.length, 0);
});

test('cross-model and cross-session success clears global lock (unlockPending)', async () => {
  const { calls, emit } = await setup();

  // Session 1 on free-a hits rate limit
  await emit(message('ses_1', 'free-a', 'msg_1', { time: { created: 10 } }));
  await emit(limitErr('ses_1'));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['--exceeded', '--model', 'free-a', '--reason', 'free_usage_exceeded']);

  // Session 2 on free-b succeeds and idles -> clears global lock via --ok
  await emit(message('ses_2', 'free-b', 'msg_2', {
    time: { created: 20, completed: 30 },
    finish: 'stop',
  }));
  await emit(idle('ses_2'));

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], ['--ok', '--model', 'free-b']);
});
