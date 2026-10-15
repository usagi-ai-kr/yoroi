import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { SourceError } from '../src/app/usage-source.js';
import { parseXaiBilling, USAGE_PERIOD_WEEKLY } from '../src/infra/xai-billing-parser.js';

const weekly = JSON.parse(await readFile(new URL('./fixtures/xai-billing-weekly.json', import.meta.url), 'utf8')) as {
  config: { creditUsagePercent: number; currentPeriod: Record<string, string> } };
const expectParse = (raw: unknown) =>
  assert.throws(() => parseXaiBilling(raw), (error: unknown) => error instanceof SourceError && error.code === 'parse');

test('주간 config는 weekly percent 창으로 매핑된다', () => {
  assert.equal(USAGE_PERIOD_WEEKLY, 'USAGE_PERIOD_TYPE_WEEKLY');
  assert.deepEqual(parseXaiBilling(weekly),
    [{ id: 'weekly', unit: 'percent', percent: 42.5, resetAt: '2026-10-20T00:00:00Z', periodStart: '2026-10-13T00:00:00Z' }]);
});

test('결손·범위밖·날짜오류는 parse 오류다', () => {
  expectParse(undefined); expectParse(null); expectParse('not-object'); expectParse(['x']);
  expectParse({}); expectParse({ config: 'nope' }); expectParse({ config: {} });
  expectParse({ config: { currentPeriod: weekly.config.currentPeriod } }); // creditUsagePercent 결손
  expectParse({ config: { creditUsagePercent: 42.5 } }); // currentPeriod 결손
  expectParse({ config: { creditUsagePercent: undefined, currentPeriod: weekly.config.currentPeriod } });
  expectParse({ config: { creditUsagePercent: 101, currentPeriod: weekly.config.currentPeriod } });
  expectParse({ config: { creditUsagePercent: -0.5, currentPeriod: weekly.config.currentPeriod } });
  expectParse({ config: { creditUsagePercent: '50', currentPeriod: weekly.config.currentPeriod } });
  expectParse({ config: { ...weekly.config, currentPeriod: { type: 'X', start: '2026-10-13T00:00:00Z', end: 'not-a-date' } } });
  expectParse({ config: { ...weekly.config, currentPeriod: { type: 'X', start: '', end: '2026-10-20T00:00:00Z' } } });
  expectParse({ config: { ...weekly.config, currentPeriod: { type: 'X', start: '2026-10-13T00:00:00Z' } } });
});

test('비 WEEKLY는 값은 보존하되 fallback window id를 쓴다(날짜 오류는 parse)', () => {
  const monthly = { config: { ...weekly.config, currentPeriod: { ...weekly.config.currentPeriod, type: 'USAGE_PERIOD_TYPE_MONTHLY' } } };
  const [window] = parseXaiBilling(monthly);
  assert.equal(window?.id, 'usage');
  assert.deepEqual([window?.unit, window?.percent, window?.resetAt, window?.periodStart],
    ['percent', 42.5, '2026-10-20T00:00:00Z', '2026-10-13T00:00:00Z']);
  expectParse({ config: { creditUsagePercent: 42.5, currentPeriod: { type: 'OTHER', start: 'bad', end: 'bad' } } });
});
