import assert from 'node:assert/strict';
import test from 'node:test';

const stateURL = new URL('../integrations/opencode/yoroi/state.js', import.meta.url).href;
const { createHooks } = await import(stateURL);
const signalsURL = new URL('../integrations/opencode/yoroi/signals.js', import.meta.url).href;
const { limitError, retryAt } = await import(signalsURL);

const message = (id = 'msg_1', extra = {}) => ({
  type: 'message.updated',
  properties: {
    info: {
      id,
      sessionID: 'ses_1',
      providerID: 'opencode',
      modelID: 'free',
      role: 'assistant',
      time: { created: 1 },
      ...extra,
    },
  },
});

const idle = { type: 'session.idle', properties: { sessionID: 'ses_1' } };

async function setup(report?: (args: string[]) => Promise<boolean>) {
  const calls: string[][] = [];
  const hooks = await createHooks({
    loadFreeModels: async () => new Set(['free']),
    report: report ?? (async (args: string[]) => {
      calls.push(args);
      return true;
    }),
  });
  return { calls, emit: (event: unknown) => hooks.event({ event }) };
}

test('limitError and retryAt handle Rate limit exceeded without fabricating retry time', () => {
  const rateLimitErr = {
    name: 'APIError',
    data: { message: 'Rate limit exceeded. Please try again later.' },
  };
  assert.equal(limitError(rateLimitErr), true);
  assert.equal(retryAt(rateLimitErr.data), undefined);

  const rateLimitExceeded = {
    name: 'APIError',
    data: { message: 'Rate limit exceeded' },
  };
  assert.equal(limitError(rateLimitExceeded), true);
  assert.equal(retryAt(rateLimitExceeded.data), undefined);

  const withHeader = {
    name: 'APIError',
    data: {
      message: 'Rate limit exceeded',
      responseHeaders: { 'retry-after': '60' },
    },
  };
  assert.equal(limitError(withHeader), true);
  assert.equal(retryAt(withHeader.data, 0), '1970-01-01T00:01:00.000Z');
});

test('session recovers and reports ok after rate limit error when next message succeeds', async () => {
  const { calls, emit } = await setup();
  // First attempt fails with Rate limit exceeded
  await emit(message('msg_fail', { time: { created: 10 } }));
  await emit({
    type: 'session.error',
    properties: {
      sessionID: 'ses_1',
      error: {
        name: 'APIError',
        data: { message: 'Rate limit exceeded. Please try again later.' },
      },
    },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['--exceeded', '--model', 'free', '--reason', 'free_usage_exceeded']);

  // Next attempt with a new message succeeds (no error, finish='stop', completed) and session becomes idle
  await emit(message('msg_ok', {
    time: { created: 20, completed: 30 },
    finish: 'stop',
  }));
  await emit(idle);

  // Should trigger --ok to clear the lock!
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], ['--ok', '--model', 'free']);
});
