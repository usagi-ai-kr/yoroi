import assert from 'node:assert/strict';
import test from 'node:test';
import { markZenLoaded } from '../src/app/zen-lock.js';
import { MemoryZenLockStore } from '../src/app/zen-lock-memory.js';
import { ZEN_FREE_SCOPE as S } from '../src/app/zen-lock-port.js';
import { parseZenFree } from '../src/ui/cli/zen-free-args.js';

test('p45 --marker: --loaded 전용, 생략 시 v1, 잘못된 값·다른 작업은 오류', () => {
  assert.deepEqual(parseZenFree(['report', '--loaded']), { kind: 'zen-free', operation: 'loaded', marker: 'v1' });
  assert.deepEqual(parseZenFree(['report', '--loaded', '--marker', 'v2']), { kind: 'zen-free', operation: 'loaded', marker: 'v2' });
  assert.equal(parseZenFree(['report', '--loaded', '--marker', 'v3']).kind, 'error');
  assert.equal(parseZenFree(['report', '--loaded', '--marker']).kind, 'error');
  assert.equal(parseZenFree(['report', '--marker', 'v2']).kind, 'error'); // status는 거부
  assert.equal(parseZenFree(['report', '--exceeded', '--marker', 'v2']).kind, 'error');
  assert.equal(parseZenFree(['report', '--ok', '--marker', 'v2']).kind, 'error');
});

test('p45 markZenLoaded가 버전을 저장한다(생략=v1, 늦은 v1은 최신 v2를 되돌리지 않음)', () => {
  const store = new MemoryZenLockStore();
  assert.equal(store.loadedVersion(S), undefined);
  markZenLoaded(store, { observedAt: '2026-10-13T00:00:00.000Z' });
  assert.deepEqual([store.loadedAt(S), store.loadedVersion(S)], ['2026-10-13T00:00:00.000Z', 'v1']);
  markZenLoaded(store, { observedAt: '2026-10-13T00:01:00.000Z', version: 'v2' });
  assert.equal(store.loadedVersion(S), 'v2');
  markZenLoaded(store, { observedAt: '2026-10-13T00:00:30.000Z', version: 'v1' });
  assert.deepEqual([store.loadedAt(S), store.loadedVersion(S)], ['2026-10-13T00:01:00.000Z', 'v2']);
});
