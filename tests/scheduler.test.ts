import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
import { TimerScheduler } from '../src/infra/scheduler.js';

test('scheduler clears timer and abort listener on resolve and cancellation', async () => {
  const scheduler = new TimerScheduler();
  const controller = new AbortController();
  await scheduler.sleep(1, controller.signal);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  const pending = scheduler.sleep(60000, controller.signal);
  controller.abort();
  await assert.rejects(pending, { code: 'cancelled' });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  await assert.rejects(scheduler.sleep(1000, controller.signal), { code: 'cancelled' });
});
