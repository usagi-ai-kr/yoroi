import assert from 'node:assert/strict';
import test from 'node:test';
import { runInsights } from '../src/composition/insights.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { runOnceDiscovery } from '../src/insights/model-discovery-once.js';
import type { DiscoveredModel, ModelRegistrySnapshot, ModelRegistrySnapshotStore } from '../src/insights/model-discovery-types.js';
import type { ProviderDiscoveryAdapter } from '../src/insights/model-discovery-adapters.js';

class MemoryStore implements ModelRegistrySnapshotStore {
  readonly map = new Map<string, ModelRegistrySnapshot>();
  async read(p: string) { return this.map.get(p); }
  async write(s: ModelRegistrySnapshot) { this.map.set(s.providerId, s); }
}
const valid = (id: string): DiscoveredModel => ({ modelId: id, displayName: id, sourceUrl: 'https://example.com/m',
  checkedOn: '2026-10-20', verified: true, planIds: ['p1'], efforts: ['default'] });
const adapter = (fn: () => Promise<DiscoveredModel[]>): ProviderDiscoveryAdapter => ({ providerId: 'p1', discover: fn });
const NOW = () => Date.parse('2026-10-20T00:00:00.000Z');
const base = { env: {}, dataEnv: {}, clock: NOW, openHistory: () => Object.assign(new MemoryInsightHistory(), { close() {} }), createPorts: () => [] };

test('1. default-off: no config or disabled is a no-op without adapter/store calls', async () => {
  let calls = 0;
  const store = new MemoryStore();
  const a = adapter(async () => { calls++; return [valid('m1')]; });
  assert.equal(await runOnceDiscovery(), undefined);
  assert.equal(await runOnceDiscovery({ config: { enabled: false }, adapters: [a], store }), undefined);
  const out = await runInsights({ ...base, discovery: { config: { enabled: false }, adapters: [a], store } });
  assert.deepEqual([calls, store.map.size, 'discoveryNotice' in out], [0, 0, false]);
});

test('2. enabled with fake adapters writes a snapshot and returns a notice', async () => {
  const store = new MemoryStore();
  const out = await runInsights({ ...base,
    discovery: { config: { enabled: true }, adapters: [adapter(async () => [valid('m1')])], store, now: NOW } });
  assert.equal((await store.read('p1'))?.models[0]?.modelId, 'm1');
  assert.match(out.discoveryNotice?.notice ?? '', /providers 1 · \+1 -0 ~0/);
  assert.equal(out.discoveryNotice?.errors, 0);
});

test('3. adapter failure does not fail once; only a notice remains', async () => {
  const store = new MemoryStore();
  const out = await runInsights({ ...base,
    discovery: { config: { enabled: true }, adapters: [adapter(async () => { throw new Error('boom'); })], store, now: NOW } });
  assert.equal(out.discoveryNotice?.errors, 1);
  assert.match(out.discoveryNotice?.notice ?? '', /errors 1/);
  assert.equal(store.map.size, 0);
});

test('4. runner-level crash is contained as a notice', async () => {
  const bad: ModelRegistrySnapshotStore = { read: async () => { throw new Error('store down'); }, write: async () => {} };
  const res = await runOnceDiscovery({ config: { enabled: true }, adapters: [adapter(async () => [valid('m1')])], store: bad });
  assert.match(res?.notice ?? '', /failed: store down/);
});

test('5. discovery leaves the run result (top10/catalog) unchanged', async () => {
  const off = await runInsights(base);
  const on = await runInsights({ ...base, discovery: { config: { enabled: true }, adapters: [adapter(async () => [valid('m1')])], store: new MemoryStore(), now: NOW } });
  const { discoveryNotice, ...rest } = on;
  assert.ok(discoveryNotice);
  assert.deepEqual(rest, off);
});
