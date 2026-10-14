import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { detectZen } from '../src/app/detect-zen.js';
import { MemoryDetectStateStore } from '../src/app/detect-state-memory.js';
import { detectKeys } from '../src/app/detect-state-port.js';
import { MemoryZenLockStore } from '../src/app/zen-lock-memory.js';
import { ZEN_FREE_SCOPE as S } from '../src/app/zen-lock-port.js';
import { openDatabase } from '../src/infra/sqlite/database.js';
import { openZenLockStore } from '../src/infra/sqlite/zen-lock-store.js';

const T0 = Date.parse('2026-10-11T00:00:00Z'), MIN = 60_000, GRACE = 10 * MIN;
const at = (m: number) => new Date(T0 + m * MIN).toISOString();
const run = (lock: MemoryZenLockStore, state: MemoryDetectStateStore, m: number, target?: 'v1' | 'v2') =>
  detectZen({ lock, state, nowMs: T0 + m * MIN, pluginStaleGraceMs: GRACE, ...(target && { target }) });

test('p43 v2: ps 없이 설치 마커(v2)와 마지막 loaded 버전으로만 stale을 판정한다', () => {
  const lock = new MemoryZenLockStore(), state = new MemoryDetectStateStore();
  assert.deepEqual(run(lock, state, 20, 'v2').map(e => [e.kind, 'marker' in e && e.marker, 'processStartedAt' in e]),
    [['plugin-stale', 'v2', false]]); // 미로드 → stale, ps 시작 시각 없음
  assert.deepEqual(run(lock, state, 21, 'v2'), [], 'same mark must not repeat');
  lock.markLoaded({ scope: S, observedAt: at(25), version: 'v1' }); // 구 플러그인이 로드됨
  assert.deepEqual(run(lock, state, 30, 'v2').map(e => 'marker' in e && e.marker), ['v2'], 'v1 로드 ≠ v2 설치 → stale');
  lock.markLoaded({ scope: S, observedAt: at(31), version: 'v2' });
  assert.deepEqual(run(lock, state, 40, 'v2'), [], '버전 일치 → 해제');
  assert.equal(state.get(detectKeys.zen('plugin-stale')), undefined);
});

test('p43 v1 기본: target이 없으면 기존 ps 판정 그대로, loadedVersion은 v1로 저장된다', () => {
  const lock = new MemoryZenLockStore(), state = new MemoryDetectStateStore();
  lock.markLoaded({ scope: S, observedAt: at(5) });
  assert.equal(lock.loadedVersion(S), 'v1');
  assert.deepEqual(run(lock, state, 10), [], 'ps 시작 정보가 없으면 v1은 판정하지 않는다');
  assert.deepEqual(run(lock, state, 20, 'v1'), []);
});

test('p43 loadedVersion 저장: 생략은 v1, 최신 loaded_at의 버전만 남고 v6 migration이 적용된다', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-zen-marker-')), env = { YOROI_DATA_DIR: root };
  const store = openZenLockStore(env);
  try {
    assert.equal(store.loadedVersion?.(S), undefined);
    store.markLoaded?.({ scope: S, observedAt: at(5) });
    assert.deepEqual([store.loadedAt?.(S), store.loadedVersion?.(S)], [at(5), 'v1']);
    store.markLoaded?.({ scope: S, observedAt: at(6), version: 'v2' });
    assert.equal(store.loadedVersion?.(S), 'v2');
    store.markLoaded?.({ scope: S, observedAt: at(4), version: 'v1' }); // 늦게 도착한 v1은 무시
    assert.deepEqual([store.loadedAt?.(S), store.loadedVersion?.(S)], [at(6), 'v2']);
    const db = openDatabase(join(root, 'yoroi.db'), { migrations: [] });
    const applied = (db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]).map(r => r.version);
    db.close();
    assert.ok(applied.includes(6), JSON.stringify(applied));
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});
