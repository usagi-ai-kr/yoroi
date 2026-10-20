import assert from 'node:assert/strict';
import test from 'node:test';
import { runModelDiscovery } from '../src/insights/model-discovery-runner.js';
import { loadModelDiscoveryConfig } from '../src/insights/model-discovery-config.js';
import type { DiscoveredModel, ModelRegistrySnapshot, ModelRegistrySnapshotStore } from '../src/insights/model-discovery-types.js';
import type { ProviderDiscoveryAdapter } from '../src/insights/model-discovery-adapters.js';

class MemoryStore implements ModelRegistrySnapshotStore {
  readonly map = new Map<string, ModelRegistrySnapshot>();
  async read(p: string) { return this.map.get(p); }
  async write(s: ModelRegistrySnapshot) { this.map.set(s.providerId, s); }
}

const valid = (id: string): DiscoveredModel => ({
  modelId: id, displayName: id, sourceUrl: 'https://example.com/m', checkedOn: '2026-10-20',
  verified: true, planIds: ['p1'], efforts: ['default'],
});
const mock = (id: string, m: DiscoveredModel[] | (() => Promise<DiscoveredModel[]>)): ProviderDiscoveryAdapter => ({
  providerId: id, discover: async () => typeof m === 'function' ? m() : m,
});

test('1. disabled config is a no-op and does not touch store', async () => {
  const store = new MemoryStore();
  const res = await runModelDiscovery({ config: loadModelDiscoveryConfig({}), adapters: [mock('p1', [valid('m1')])], store });
  assert.equal(res.enabled, false); assert.equal(res.summary.providers, 0); assert.equal(store.map.size, 0);
});

test('2. successful provider writes a snapshot to store', async () => {
  const store = new MemoryStore();
  const res = await runModelDiscovery({
    config: { enabled: true }, adapters: [mock('p1', [valid('m1')])], store,
    observedAt: '2026-10-20T00:00:00.000Z', now: () => Date.parse('2026-10-20T00:00:00.000Z'),
  });
  assert.equal(res.enabled, true); assert.equal(res.summary.added, 1);
  const snap = await store.read('p1');
  assert.equal(snap?.generation, 1); assert.equal(snap?.models[0]?.modelId, 'm1');
});

test('3. failed collection preserves last-good snapshot', async () => {
  const store = new MemoryStore();
  await store.write({ generation: 1, observedAt: '2026-10-20T00:00:00.000Z', providerId: 'p1', models: [valid('m1')] });
  const res = await runModelDiscovery({
    config: { enabled: true }, adapters: [mock('p1', async () => { throw new Error('API err'); })],
    store, now: () => Date.parse('2026-10-20T01:00:00.000Z'),
  });
  assert.equal(res.errors.length, 1); assert.equal(res.summary.errors, 1);
  const after = await store.read('p1');
  assert.equal(after?.generation, 1); assert.equal(after?.models[0]?.modelId, 'm1');
});

test('4. unverified and invalid rows are rejected from snapshot', async () => {
  const store = new MemoryStore();
  const unverified: DiscoveredModel = { ...valid('unver'), verified: false };
  const noEffort: DiscoveredModel = { ...valid('no-eff'), efforts: [] };
  const res = await runModelDiscovery({
    config: { enabled: true }, adapters: [mock('p1', [unverified, noEffort, valid('good')])],
    store, observedAt: '2026-10-20T00:00:00.000Z', now: () => Date.parse('2026-10-20T00:00:00.000Z'),
  });
  assert.equal(res.summary.added, 1);
  const snap = await store.read('p1');
  assert.deepEqual(snap?.models.map(m => m.modelId), ['good']);
});

test('5. diff summary calculates added, removed, changed', async () => {
  const store = new MemoryStore();
  await store.write({ generation: 1, observedAt: '2026-10-20T00:00:00.000Z', providerId: 'p1', models: [valid('m1'), valid('m2')] });
  const res = await runModelDiscovery({
    config: { enabled: true }, adapters: [mock('p1', [{ ...valid('m2'), displayName: 'New' }, valid('m3')])],
    store, observedAt: '2026-10-20T01:00:00.000Z', now: () => Date.parse('2026-10-20T01:00:00.000Z'),
  });
  assert.equal(res.summary.added, 1); assert.equal(res.summary.removed, 1); assert.equal(res.summary.changed, 1);
});

test('6. provider isolation across multiple adapters', async () => {
  const store = new MemoryStore();
  const res = await runModelDiscovery({
    config: { enabled: true }, adapters: [mock('pA', [valid('mA')]), mock('pB', [valid('mB')])],
    store, observedAt: '2026-10-20T00:00:00.000Z', now: () => Date.parse('2026-10-20T00:00:00.000Z'),
  });
  assert.equal(res.summary.providers, 2);
  const snapA = await store.read('pA'), snapB = await store.read('pB');
  assert.deepEqual(snapA?.models.map(m => m.modelId), ['mA']); assert.deepEqual(snapB?.models.map(m => m.modelId), ['mB']);
});

test('7. config.providers filters adapters', async () => {
  const store = new MemoryStore();
  const res = await runModelDiscovery({
    config: { enabled: true, providers: ['pA'] },
    adapters: [mock('pA', [valid('mA')]), mock('pB', [valid('mB')])],
    store, now: () => Date.parse('2026-10-20T00:00:00.000Z'),
  });
  assert.equal(res.summary.providers, 1);
  assert.equal(await store.read('pB'), undefined);
});
