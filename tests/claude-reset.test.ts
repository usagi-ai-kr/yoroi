import assert from 'node:assert/strict';
import test from 'node:test';
import { parseClaudeReset } from '../src/infra/claude-reset.js';

// 가상 값만 사용한다. 실제 사용량 출력이나 계정 정보는 복사하지 않는다.
const observedAt = '2026-10-07T00:00:00Z';

function expectInstant(actual: string | undefined, expected: string): void {
  assert.equal(typeof actual, 'string');
  assert.equal(Date.parse(actual as string), Date.parse(expected));
}

test('converts a Seoul wall-clock reset to the UTC instant', () => {
  expectInstant(parseClaudeReset('Oct 8 at 3:42pm (Asia/Seoul)', observedAt), '2026-10-08T06:42:00Z');
});

test('maps 12am to midnight and 12pm to noon', () => {
  expectInstant(parseClaudeReset('Oct 8 at 12am (UTC)', observedAt), '2026-10-08T00:00:00Z');
  expectInstant(parseClaudeReset('Oct 8 at 12pm (UTC)', observedAt), '2026-10-08T12:00:00Z');
});

test('uses an explicit year instead of the observation year', () => {
  expectInstant(parseClaudeReset('Oct 8, 2027 at 3:42pm (Asia/Seoul)', observedAt), '2027-10-08T06:42:00Z');
});

test('picks the closest candidate year when a December observation resets in January', () => {
  expectInstant(
    parseClaudeReset('Jan 1 at 9am (UTC)', '2026-12-31T23:00:00Z'),
    '2027-01-01T09:00:00Z',
  );
});

test('picks the closest candidate year when a January observation resets in December', () => {
  expectInstant(
    parseClaudeReset('Dec 31 at 11pm (UTC)', '2027-01-01T00:30:00Z'),
    '2026-12-31T23:00:00Z',
  );
});

test('skips invalid leap-day candidates and selects the nearest valid year', () => {
  expectInstant(
    parseClaudeReset('Feb 29 at 12pm (UTC)', '2027-03-01T00:00:00Z'),
    '2028-02-29T12:00:00Z',
  );
});

test('applies New York daylight time in summer and standard time in winter', () => {
  expectInstant(
    parseClaudeReset('Jul 4 at 9am (America/New_York)', '2026-06-01T00:00:00Z'),
    '2026-07-04T13:00:00Z',
  );
  expectInstant(
    parseClaudeReset('Jan 15 at 9am (America/New_York)', '2026-01-01T00:00:00Z'),
    '2026-01-15T14:00:00Z',
  );
});

test('returns undefined for a repeated fall-back hour in New York', () => {
  assert.equal(parseClaudeReset('Nov 1 at 1:30am (America/New_York)', '2026-10-31T00:00:00Z'), undefined);
});

test('returns undefined for a skipped spring-forward hour in New York', () => {
  assert.equal(parseClaudeReset('Mar 8 at 2:30am (America/New_York)', '2026-03-01T00:00:00Z'), undefined);
});

test('returns undefined for an impossible calendar date', () => {
  assert.equal(parseClaudeReset('Feb 30 at 3pm (UTC)', observedAt), undefined);
});

test('returns undefined for an unknown IANA time zone', () => {
  assert.equal(parseClaudeReset('Oct 8 at 3pm (Mars/Olympus)', observedAt), undefined);
});

test('returns undefined for an unsupported or out-of-range time format', () => {
  assert.equal(parseClaudeReset('tomorrow at 3pm (UTC)', observedAt), undefined);
  assert.equal(parseClaudeReset('Oct 8 at 25:00 (UTC)', observedAt), undefined);
  assert.equal(parseClaudeReset('Oct 8 at 13pm (UTC)', observedAt), undefined);
});

test('returns undefined when the time zone is absent', () => {
  assert.equal(parseClaudeReset('Oct 8 at 3pm', observedAt), undefined);
});

test('uses the regional observation year and handles fractional-hour offsets', () => {
  expectInstant(parseClaudeReset('Jan 1 at 12:01am (Asia/Tokyo)', '2026-12-31T15:00:00Z'),
    '2026-12-31T15:01:00Z');
  expectInstant(parseClaudeReset('Oct 8 at 3:42pm (Asia/Kathmandu)', observedAt), '2026-10-08T09:57:00Z');
});

test('rejects invalid observation dates, early years and ambiguous zone abbreviations', () => {
  assert.equal(parseClaudeReset('Oct 8 at 3pm (UTC)', 'invalid'), undefined);
  assert.equal(parseClaudeReset('Oct 8, 0001 at 3pm (UTC)', observedAt), undefined);
  assert.equal(parseClaudeReset('Oct 8 at 3pm (EST)', observedAt), undefined);
});
