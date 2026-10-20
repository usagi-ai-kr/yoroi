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

test('스냅샷 판정: 없음·무효 세대·무효 시각·미래는 거부한다', () => {
  assert.deepEqual(selectSnapshot(undefined, NOW), { snapshot: undefined, reason: 'missing' });
  assert.equal(selectSnapshot(snapshot({ generation: 0 }), NOW).reason, 'invalid');
  assert.equal(selectSnapshot(snapshot({ observedAt: '어제' }), NOW).reason, 'invalid');
  assert.equal(selectSnapshot(snapshot({ observedAt: '2026-10-21T00:00:00.000Z' }), NOW).reason, 'future');
  assert.equal(selectSnapshot(snapshot(), NOW).reason, 'usable');
});

test('30일 경계는 정확히 30일이면 유효하고 1ms 넘으면 만료된다', () => {
  const exact = snapshot({ observedAt: new Date(NOW - SNAPSHOT_MAX_AGE_MS).toISOString() });
  assert.equal(selectSnapshot(exact, NOW).reason, 'usable');
  const over = snapshot({ observedAt: new Date(NOW - SNAPSHOT_MAX_AGE_MS - 1).toISOString() });
  assert.equal(selectSnapshot(over, NOW).reason, 'expired');
  assert.equal(SNAPSHOT_MAX_AGE_MS, 30 * DAY);
});

test('수집 실패는 last-good을 그대로 보존한다', () => {
  const current = snapshot();
  const resolved = resolveCollection(current, 'opencode', { ok: false, error: 'network' }, NOW);
  assert.equal(resolved.changed, false);
  assert.equal(resolved.snapshot, current);
  assert.equal(resolved.reason, 'failed');
});

test('수집 실패인데 last-good이 없거나 만료면 새 세대를 만들지 않는다', () => {
  const missing = resolveCollection(undefined, 'opencode', { ok: false, error: 'network' }, NOW);
  assert.equal(missing.snapshot, undefined);
  assert.equal(missing.reason, 'missing');
  assert.equal(missing.changed, false);
  const expired = snapshot({ observedAt: new Date(NOW - SNAPSHOT_MAX_AGE_MS - 1).toISOString() });
  const result = resolveCollection(expired, 'opencode', { ok: false, error: 'network' }, NOW);
  assert.equal(result.snapshot, undefined);
  assert.equal(result.reason, 'expired');
});

test('성공한 수집은 세대를 1 올리고 순서를 고정한다', () => {
  const current = snapshot();
  const resolved = resolveCollection(current, 'opencode',
    { ok: true, models: [model('muse-spark-1-3'), model('kimi-k3')], observedAt: '2026-10-20T00:00:00.000Z' }, NOW);
  assert.equal(resolved.changed, true);
  assert.equal(resolved.snapshot?.generation, 2);
  assert.deepEqual(resolved.snapshot?.models.map(m => m.modelId), ['kimi-k3', 'muse-spark-1-3']);
});

test('순서만 다른 모델 목록은 같은 세대 내용이다', () => {
  const a = buildSnapshot(undefined, 'opencode', [model('kimi-k3'), model('grok-4-7')], '2026-10-20T00:00:00.000Z', NOW);
  const b = buildSnapshot(undefined, 'opencode', [model('grok-4-7'), model('kimi-k3')], '2026-10-20T00:00:00.000Z', NOW);
  assert.deepEqual(a.snapshot?.models, b.snapshot?.models);
  assert.equal(a.snapshot?.generation, 1);
});

test('미래 시각·무효 시각의 수집은 새 세대를 만들지 않는다', () => {
  const future = buildSnapshot(undefined, 'opencode', [model('kimi-k3')], '2026-10-21T00:00:00.000Z', NOW);
  assert.equal(future.snapshot, undefined);
  assert.equal(future.reason, 'future');
  const invalid = buildSnapshot(undefined, 'opencode', [model('kimi-k3')], '나중', NOW);
  assert.equal(invalid.snapshot, undefined);
  assert.equal(invalid.reason, 'invalid');
});
