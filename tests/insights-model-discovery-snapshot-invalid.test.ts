import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSnapshot, resolveCollection, selectSnapshot, SNAPSHOT_MAX_AGE_MS } from '../src/insights/model-discovery-snapshot.js';
import type { DiscoveredModel, ModelRegistrySnapshot } from '../src/insights/model-discovery-types.js';

const NOW = Date.parse('2026-10-20T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const model = (modelId: string): DiscoveredModel => ({
  modelId, displayName: modelId, sourceUrl: 'https://opencode.ai/go', checkedOn: '2026-10-20',
  verified: true, planIds: ['opencode-go-plus'], efforts: ['high'] });

const snapshot = (over: Partial<ModelRegistrySnapshot> = {}): ModelRegistrySnapshot => ({
  generation: 1, observedAt: '2026-10-19T00:00:00.000Z', providerId: 'opencode', models: [model('kimi-k3')], ...over });

const ok = (observedAt: string) => ({ ok: true as const, models: [model('grok-4-7')], observedAt });

test('무효·미래·만료 관측의 성공 회차는 유효 last-good을 보존한다', () => {
  const current = snapshot();
  const invalid = resolveCollection(current, 'opencode', ok('junk'), NOW);
  assert.equal(invalid.snapshot, current);
  assert.equal(invalid.reason, 'invalid');
  assert.equal(invalid.changed, false);
  const future = resolveCollection(current, 'opencode', ok('2026-10-21T00:00:00.000Z'), NOW);
  assert.equal(future.snapshot, current);
  assert.equal(future.reason, 'future');
  assert.equal(future.changed, false);
  const expired = resolveCollection(current, 'opencode', ok(new Date(NOW - SNAPSHOT_MAX_AGE_MS - 1).toISOString()), NOW);
  assert.equal(expired.snapshot, current);
  assert.equal(expired.reason, 'expired');
  assert.equal(expired.changed, false);
});

test('만료 관측은 build 단계에서 거부된다 — 30일 게이트가 build에도 적용된다', () => {
  const built = buildSnapshot(undefined, 'opencode', [model('kimi-k3')],
    new Date(NOW - SNAPSHOT_MAX_AGE_MS - 1).toISOString(), NOW);
  assert.equal(built.snapshot, undefined);
  assert.equal(built.reason, 'expired');
  const exact = buildSnapshot(undefined, 'opencode', [model('kimi-k3')],
    new Date(NOW - SNAPSHOT_MAX_AGE_MS).toISOString(), NOW);
  assert.equal(exact.reason, 'usable');
});

test('다른 provider의 current는 재사용하지 않는다 — 실패 회차는 last-good이 없다', () => {
  const other = snapshot({ providerId: 'provider-a' });
  const failed = resolveCollection(other, 'provider-b', { ok: false, error: 'network' }, NOW);
  assert.equal(failed.snapshot, undefined);
  assert.equal(failed.reason, 'missing');
  assert.equal(failed.changed, false);
});

test('다른 provider의 세대를 승계하지 않는다', () => {
  const other = snapshot({ providerId: 'provider-a', generation: 7 });
  const built = resolveCollection(other, 'provider-b', ok('2026-10-20T00:00:00.000Z'), NOW);
  assert.equal(built.changed, true);
  assert.equal(built.snapshot?.generation, 1);
  assert.equal(built.snapshot?.providerId, 'provider-b');
  const same = resolveCollection(snapshot({ generation: 3 }), 'opencode', ok('2026-10-20T00:00:00.000Z'), NOW);
  assert.equal(same.snapshot?.generation, 4);
});

test('nowMs가 유한하지 않으면 판정 불가(invalid)다', () => {
  assert.equal(selectSnapshot(snapshot(), Number.NaN).reason, 'invalid');
  assert.equal(selectSnapshot(snapshot(), Number.NaN).snapshot, undefined);
  assert.equal(selectSnapshot(snapshot(), Number.POSITIVE_INFINITY).reason, 'invalid');
  assert.equal(buildSnapshot(undefined, 'opencode', [model('kimi-k3')], '2026-10-20T00:00:00.000Z', Number.NaN).reason, 'invalid');
  const resolved = resolveCollection(snapshot(), 'opencode', ok('2026-10-20T00:00:00.000Z'), Number.NaN);
  assert.equal(resolved.changed, false);
  assert.equal(resolved.snapshot, undefined);
  assert.equal(resolved.reason, 'invalid');
});

test('실패 입력과 만료·무효 last-good을 구분한다', () => {
  const valid = resolveCollection(snapshot(), 'opencode', { ok: false, error: 'network' }, NOW);
  assert.equal(valid.reason, 'failed');
  assert.equal(valid.snapshot !== undefined, true);
  const expired = resolveCollection(snapshot({ observedAt: new Date(NOW - SNAPSHOT_MAX_AGE_MS - 1).toISOString() }),
    'opencode', { ok: false, error: 'network' }, NOW);
  assert.equal(expired.reason, 'expired');
  assert.equal(expired.snapshot, undefined);
  const invalid = resolveCollection(snapshot({ generation: 0 }), 'opencode', { ok: false, error: 'network' }, NOW);
  assert.equal(invalid.reason, 'invalid');
  assert.equal(invalid.snapshot, undefined);
  const missing = resolveCollection(undefined, 'opencode', { ok: false, error: 'network' }, NOW);
  assert.equal(missing.reason, 'missing');
});
