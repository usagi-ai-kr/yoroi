import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnapshot } from '../src/domain/usage.js';
import { SourceError } from '../src/app/usage-source.js';
import { buildCollectionEvents } from '../src/app/collection-events.js';

const at = '2026-10-08T00:00:00Z';
const ok = (provider: 'codex' | 'agy' | 'claude', resetAt = '2026-10-15T00:00:00Z') => ({
  provider, snapshot: createSnapshot(provider, at,
    [{ id: 'weekly', unit: 'requests', percent: 30, resetAt }]),
});
const err = (provider: 'codex' | 'agy' | 'claude', code: 'authentication' | 'timeout' = 'timeout') => ({
  provider, error: new SourceError(code),
});

test('all success yields one usage.collected without provider data', () => {
  const events = buildCollectionEvents([ok('codex'), ok('agy')], at);
  assert.deepEqual(events, [{ name: 'usage.collected', at }]);
});

test('partial failure yields usage.partial and per-provider auth.expired only', () => {
  const events = buildCollectionEvents([ok('codex'), err('agy', 'authentication'), err('claude')], at);
  assert.deepEqual(events, [
    { name: 'usage.partial', at },
    { name: 'auth.expired', provider: 'agy', at, errorCode: 'authentication' },
  ]);
});

test('resetChanged fires only on defined resetAt change', () => {
  const previous = new Map([['codex', ok('codex').snapshot]]);
  const changed = buildCollectionEvents(
    [ok('codex', '2026-10-22T00:00:00Z')], at, previous);
  assert.deepEqual(changed, [
    { name: 'usage.collected', at },
    { name: 'usage.resetChanged', provider: 'codex', at, resetAt: '2026-10-22T00:00:00Z' },
  ]);
  const same = buildCollectionEvents([ok('codex')], at, previous);
  assert.deepEqual(same, [{ name: 'usage.collected', at }]);
  const noPrev = buildCollectionEvents([ok('codex', '2026-10-22T00:00:00Z')], at);
  assert.deepEqual(noPrev, [{ name: 'usage.collected', at }]);
});

test('events carry no secrets, raw values, or estimates', () => {
  const events = buildCollectionEvents(
    [ok('codex'), err('agy', 'authentication')], at,
    new Map([['codex', ok('codex').snapshot]]));
  const raw = JSON.stringify(events);
  for (const banned of ['windows', 'snapshot', 'percent', 'used', 'estimate', 'token', 'key']) {
    assert.ok(!raw.includes(`"${banned}"`), banned);
  }
  for (const event of events) {
    assert.deepEqual(Object.keys(event).sort(),
      Object.keys(event).filter(key =>
        ['name', 'provider', 'at', 'errorCode', 'resetAt'].includes(key)).sort());
  }
});
