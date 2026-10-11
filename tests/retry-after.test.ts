import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RETRY_AFTER_MS, rateLimitDelayMs, retryAfterSeconds, withRetryAfter } from '../src/domain/errors.js';
import { parseRetryAfter } from '../src/domain/retry-after.js';
import { SourceError } from '../src/app/usage-source.js';

const start = Date.parse('2026-01-01T00:00:00Z');
test('Retry-After parses integer seconds and HTTP-date against a fake clock', () => {
  assert.equal(parseRetryAfter(' 2 ', start), 2000);
  assert.equal(parseRetryAfter('0', start), 0);
  assert.equal(parseRetryAfter('Thu, 01 Jan 2026 00:00:03 GMT', start + 500), 2500);
  assert.equal(parseRetryAfter('Wed, 31 Dec 2025 23:59:59 GMT', start), 0);
  assert.equal(parseRetryAfter('Thursday, 01-Jan-26 00:00:03 GMT', start), 3000);
  assert.equal(parseRetryAfter('Thu Jan  1 00:00:03 2026', start), 3000);
  assert.equal(parseRetryAfter('Sunday, 06-Nov-94 08:49:37 GMT', start), 0);
  const oldClock = Date.parse('1990-01-01T00:00:00Z');
  assert.equal(parseRetryAfter('Wednesday, 01-Jan-20 00:00:00 GMT', oldClock),
    Date.parse('2020-01-01T00:00:00Z') - oldClock);
  assert.equal(parseRetryAfter('9007199254740991', start), Infinity);
  for (const value of [undefined, '', '-1', '+1', '1.5', '1e3', 'Infinity', '2026-01-01',
    'Thu, 31 Feb 2026 00:00:00 GMT', 'Wed, 01 Jan 2026 00:00:00 GMT',
    'synthetic-private-value']) {
    assert.equal(parseRetryAfter(value, start), undefined);
  }
  assert.equal(parseRetryAfter('2', NaN), undefined);
});

test('withRetryAfter never throws: oversized or infinite values are capped at 24 hours and the SourceError stays', () => {
  const cases: [string, number][] = [['99999999999999999999', MAX_RETRY_AFTER_MS], ['9007199254740991', MAX_RETRY_AFTER_MS], ['9007199254740', MAX_RETRY_AFTER_MS],
    ['86401', MAX_RETRY_AFTER_MS], ['86400', MAX_RETRY_AFTER_MS], ['3600', 3_600_000], ['0', 0], ['Fri, 01 Jan 2027 00:00:00 GMT', MAX_RETRY_AFTER_MS]];
  for (const [header, expected] of cases) {
    const error = withRetryAfter(new SourceError('unavailable'), { 'Retry-After': header }, start);
    assert.ok(error instanceof SourceError && error.code === 'unavailable', header);
    assert.equal(rateLimitDelayMs(error), expected, header);
  }
  for (const header of ['', 'nope', '-1', '1.5']) assert.equal(rateLimitDelayMs(withRetryAfter(new SourceError('unavailable'), { 'retry-after': header }, start)), undefined, header);
  assert.equal(rateLimitDelayMs(withRetryAfter(new SourceError('unavailable'), {}, start)), undefined);
  assert.deepEqual([retryAfterSeconds(MAX_RETRY_AFTER_MS), retryAfterSeconds(2 ** 52), retryAfterSeconds(0), retryAfterSeconds(1500)], ['86400', '86400', '1', '2']);
});
