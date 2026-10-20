import assert from 'node:assert/strict';
import test from 'node:test';
import { RECOMMENDED_DISCOVERY_PROVIDERS, loadModelDiscoveryConfig, resolveDiscoveryBaseDir } from '../src/insights/model-discovery-config.js';
import { runModelDiscovery } from '../src/insights/model-discovery-runner.js';
import type { DiscoveredModel, ModelRegistrySnapshot, ModelRegistrySnapshotStore } from '../src/insights/model-discovery-types.js';
import type { ProviderDiscoveryAdapter } from '../src/insights/model-discovery-adapters.js';

class MemoryStore implements ModelRegistrySnapshotStore {
  readonly map = new Map<string, ModelRegistrySnapshot>();
  async read(p: string) { return this.map.get(p); }
  async write(s: ModelRegistrySnapshot) { this.map.set(s.providerId, s); }
}
const valid = (id: string): DiscoveredModel => ({ modelId: id, displayName: id, sourceUrl: 'https://example.com/m',
  checkedOn: '2026-10-20', verified: true, planIds: ['p1'], efforts: ['default'] });
const mock = (id: string, m: DiscoveredModel[] | (() => Promise<DiscoveredModel[]>)): ProviderDiscoveryAdapter => ({
  providerId: id, discover: async () => typeof m === 'function' ? m() : m });
const NOW = () => Date.parse('2026-10-20T00:00:00.000Z');

test('1. disabled config is a no-op and does not touch store', async () => {
  const store = new MemoryStore();
  const res = await runModelDiscovery({ config: loadModelDiscoveryConfig({}), adapters: [mock('p1', [valid('m1')])], store });
  assert.deepEqual([res.enabled, res.summary.providers, store.map.size], [false, 0, 0]);
});

test('2. successful provider writes a snapshot to store', async () => {
  const store = new MemoryStore();
  const res = await runModelDiscovery({ config: { enabled: true }, adapters: [mock('p1', [valid('m1')])], store, now: NOW });
  assert.equal(res.enabled, true); assert.equal(res.summary.added, 1);
  const snap = await store.read('p1');
  assert.deepEqual([snap?.generation, snap?.models[0]?.modelId], [1, 'm1']);
});

test('3. failed collection preserves last-good snapshot', async () => {
  const store = new MemoryStore();
  await store.write({ generation: 1, observedAt: '2026-10-20T00:00:00.000Z', providerId: 'p1', models: [valid('m1')] });
  const res = await runModelDiscovery({ config: { enabled: true }, adapters: [mock('p1', async () => { throw new Error('API err'); })], store, now: NOW });
  assert.deepEqual([res.errors.length, res.summary.errors], [1, 1]);
  const after = await store.read('p1');
  assert.deepEqual([after?.generation, after?.models[0]?.modelId], [1, 'm1']);
});

test('4. unverified and invalid rows are rejected from snapshot', async () => {
  const store = new MemoryStore();
  const res = await runModelDiscovery({ config: { enabled: true },
    adapters: [mock('p1', [{ ...valid('unver'), verified: false }, { ...valid('no-eff'), efforts: [] }, valid('good')])], store, now: NOW });
  assert.equal(res.summary.added, 1);
  assert.deepEqual((await store.read('p1'))?.models.map(m => m.modelId), ['good']);
});

test('5. diff summary calculates added, removed, changed', async () => {
  const store = new MemoryStore();
  await store.write({ generation: 1, observedAt: '2026-10-20T00:00:00.000Z', providerId: 'p1', models: [valid('m1'), valid('m2')] });
  const res = await runModelDiscovery({ config: { enabled: true }, adapters: [mock('p1', [{ ...valid('m2'), displayName: 'New' }, valid('m3')])], store, now: NOW });
  assert.deepEqual([res.summary.added, res.summary.removed, res.summary.changed], [1, 1, 1]);
});

test('6. provider isolation across multiple adapters', async () => {
  const store = new MemoryStore();
  const res = await runModelDiscovery({ config: { enabled: true }, adapters: [mock('pA', [valid('mA')]), mock('pB', [valid('mB')])], store, now: NOW });
  assert.equal(res.summary.providers, 2);
  assert.deepEqual([(await store.read('pA'))?.models[0]?.modelId, (await store.read('pB'))?.models[0]?.modelId], ['mA', 'mB']);
});

test('7. config.providers filters adapters', async () => {
  const store = new MemoryStore();
  const res = await runModelDiscovery({ config: { enabled: true, providers: ['pA'] }, adapters: [mock('pA', [valid('mA')]), mock('pB', [valid('mB')])], store, now: NOW });
  assert.equal(res.summary.providers, 1);
  assert.equal(await store.read('pB'), undefined);
});

test('8. recommended policy defaults without enabling discovery', () => {
  assert.deepEqual(loadModelDiscoveryConfig({}), { enabled: false, autoEnroll: false, deprecation: 'diff-only' });
  const cfg = loadModelDiscoveryConfig({ discovery: { enabled: true } });
  assert.deepEqual([cfg.enabled, cfg.providers, cfg.autoEnroll, cfg.deprecation], [true, RECOMMENDED_DISCOVERY_PROVIDERS, false, 'diff-only']);
  assert.deepEqual(RECOMMENDED_DISCOVERY_PROVIDERS, ['opencode', 'openrouter', 'ollama']);
});

test('9. baseDir resolves XDG, home injection, and explicit override', () => {
  assert.equal(resolveDiscoveryBaseDir({ env: { XDG_CONFIG_HOME: '/x' } }), '/x/yoroi/discovery');
  assert.equal(resolveDiscoveryBaseDir({ env: {}, home: '/h' }), '/h/.config/yoroi/discovery');
  assert.equal(resolveDiscoveryBaseDir({ env: { XDG_CONFIG_HOME: '/x' }, override: '/o' }), '/o');
});

test('10. excluded wins over providers without network', async () => {
  const store = new MemoryStore();
  const res = await runModelDiscovery({ config: { enabled: true, providers: ['pA'], excluded: ['mA'] }, adapters: [mock('pA', [valid('mA')])], store, now: NOW });
  assert.equal(res.summary.added, 0);
  assert.deepEqual((await store.read('pA'))?.models.map(m => m.modelId), []);
});

test('11. explicit empty providers means zero providers, not unspecified', async () => {
  const cfg = loadModelDiscoveryConfig({ discovery: { enabled: true, providers: [] } });
  assert.deepEqual(cfg.providers, []);
  const store = new MemoryStore();
  const res = await runModelDiscovery({ config: cfg, adapters: [mock('pA', [valid('mA')])], store, now: NOW });
  assert.equal(res.summary.providers, 0);
  assert.equal(await store.read('pA'), undefined);
});
