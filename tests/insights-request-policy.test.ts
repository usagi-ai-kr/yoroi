import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_REQUEST_POLICY, decideRequest, decideRetry,
  type RequestState } from '../src/insights/request-policy.js';

const start = Date.parse('2026-01-01T00:00:00Z');
const state = (changes: Partial<RequestState> = {}): RequestState => ({
  startedAtMs: start, nowMs: start, requestsMade: 0, retriesMade: 0, ...changes,
});
test('oversized Retry-After exhausts the source budget', () => {
  assert.deepEqual(decideRetry({ ...state(), retryable: true, retryAfter: '99999999999999999999' }),
    { allowed: false, reason: 'budget-exhausted' });
});
test('source HTTP budget permits ten total attempts including pages and a retry', () => {
  assert.deepEqual(DEFAULT_REQUEST_POLICY,
    { maxRetries: 1, maxRequests: 10, budgetMs: 60000, retryDelayMs: 1000 });
  assert.ok(Object.isFrozen(DEFAULT_REQUEST_POLICY));
  let requestsMade = 0;
  for (let page = 0; page < 9; page++) {
    assert.equal(decideRequest(state({ requestsMade })).allowed, true);
    requestsMade++;
  }
  assert.equal(decideRetry({ ...state({ requestsMade }), retryable: true }).allowed, true);
  requestsMade++;
  assert.deepEqual(decideRequest(state({ requestsMade })), { allowed: false, reason: 'request-limit' });
  assert.deepEqual(decideRetry({ ...state({ requestsMade }), retryable: true }),
    { allowed: false, reason: 'request-limit' });
});
test('only one source-wide retry is allowed; non-retryable failures stop', () => {
  const initial = { ...state({ requestsMade: 1 }), retryable: true };
  assert.deepEqual(decideRetry(initial), { allowed: true, waitMs: 1000, timeoutMs: 59000 });
  assert.deepEqual(decideRetry({ ...initial, retriesMade: 1 }), { allowed: false, reason: 'retry-limit' });
  assert.deepEqual(decideRetry({ ...initial, retryable: false }), { allowed: false, reason: 'not-retryable' });
});
test('fake clock budget includes elapsed time and Retry-After; equality stops', () => {
  const initial = { ...state({ nowMs: start + 59000, requestsMade: 1 }), retryable: true };
  assert.deepEqual(decideRequest(initial), { allowed: true, waitMs: 0, timeoutMs: 1000 });
  for (const retryAfter of ['1', '2', 'Thu, 01 Jan 2026 00:01:00 GMT']) {
    assert.deepEqual(decideRetry({ ...initial, retryAfter }), { allowed: false, reason: 'budget-exhausted' });
  }
  assert.deepEqual(decideRetry({ ...initial, retryAfter: '0' }),
    { allowed: true, waitMs: 0, timeoutMs: 1000 });
  for (const elapsed of [60000, 60001]) assert.deepEqual(decideRequest(state({ nowMs: start + elapsed })),
    { allowed: false, reason: 'budget-exhausted' });
});
test('invalid headers use an injected fallback; injected limits affect decisions', () => {
  const initial = { ...state({ requestsMade: 1, retriesMade: 1 }), retryable: true, retryAfter: 'invalid' };
  assert.deepEqual(decideRetry(initial, { maxRetries: 2, maxRequests: 2, budgetMs: 500, retryDelayMs: 25 }),
    { allowed: true, waitMs: 25, timeoutMs: 475 });
  assert.deepEqual(decideRequest(state(), { maxRequests: 0 }), { allowed: false, reason: 'request-limit' });
  assert.deepEqual(decideRetry({ ...initial, retriesMade: 0 }, { maxRetries: 0 }),
    { allowed: false, reason: 'retry-limit' });
});
test('cancellation and invalid state stop; invalid policy throws without exposing inputs', () => {
  assert.deepEqual(decideRequest(state({ cancelled: true })), { allowed: false, reason: 'cancelled' });
  for (const change of [{ nowMs: start - 1 }, { requestsMade: -1 }, { retriesMade: 0.5 },
    { nowMs: Infinity }, { startedAtMs: NaN }]) {
    assert.deepEqual(decideRequest(state(change)), { allowed: false, reason: 'invalid-state' });
  }
  for (const overrides of [{ budgetMs: 0 }, { maxRetries: -1 }, { maxRequests: 1.5 },
    { retryDelayMs: Infinity }]) assert.throws(() => decideRequest(state(), overrides), RangeError);
});
test('rechecking after a planned wait prevents a late dispatch without mutating state', () => {
  const initial = { ...state({ requestsMade: 1 }), retryable: true, retryAfter: '59' };
  const copy = { ...initial };
  assert.deepEqual(decideRetry(initial), { allowed: true, waitMs: 59000, timeoutMs: 1000 });
  assert.deepEqual(decideRequest({ ...initial, nowMs: start + 60000 }),
    { allowed: false, reason: 'budget-exhausted' });
  assert.deepEqual(initial, copy);
});
