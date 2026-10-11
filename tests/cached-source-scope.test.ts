import assert from 'node:assert/strict';
import test from 'node:test';
import { CachedSource } from '../src/app/cached-source.js';
import type { UsageCache, UsageCacheKey } from '../src/app/usage-cache-port.js';
import { SourceError, type UsageSource } from '../src/app/usage-source.js';
import { createSnapshot } from '../src/domain/usage.js';

const observedAt = '2026-01-01T00:00:00.000Z', now = Date.parse(observedAt) + 1000;
const snapshot = createSnapshot('claude', observedAt, [{ id: '5h', unit: '%', percent: 20 }]);
const base = { provider: 'claude', lookup: 'windows:all', scope: 'a'.repeat(24), contractVersion: 'v1' } as const;
function setup(principal: (signal?: AbortSignal) => Promise<string>, refresh = false) {
  const log: string[] = []; const keys: UsageCacheKey[] = [];
  const source: UsageSource = { provider: 'claude', async read() { log.push('read'); return snapshot; } };
  const cache: UsageCache = { get(k) { log.push('get'); keys.push(k); return undefined; },
    set(k) { log.push('set'); keys.push(k); }, prune: () => 0, close() {} };
  const history = { record(_s: unknown, k: UsageCacheKey) { log.push('record'); keys.push(k); },
    latestTwo: () => [] as const, prune: () => 0, close() {} };
  const wrapped = new CachedSource(source, { cache, history, key: base, clock: () => now, refresh,
    principal: async signal => { log.push('principal'); return principal(signal); } });
  return { wrapped, log, keys };
}
test('principal resolves before the cache lookup and extends the scope for get, set and record', async () => {
  const h = setup(async () => 'stable-0123456789abcdef');
  await h.wrapped.read();
  assert.deepEqual(h.log, ['principal', 'get', 'read', 'set', 'record']);
  assert.ok(h.keys.every(k => k.scope === `${base.scope}.stable-0123456789abcdef`));
});
test('refresh still resolves the principal so writes land in the right account series', async () => {
  const h = setup(async () => 'cred-0123456789abcdef', true);
  await h.wrapped.read();
  assert.deepEqual(h.log, ['principal', 'read', 'set', 'record']);
});
test('an unresolvable or unsafe principal bypasses cache and history; the source reports the error', async () => {
  for (const principal of [async () => { throw new SourceError('authentication'); }, async () => 'unsafe principal']) {
    const h = setup(principal);
    assert.equal(await h.wrapped.read(), snapshot);
    assert.deepEqual(h.log, ['principal', 'read']);
    assert.equal(h.wrapped.meta, undefined);
  }
});
test('cancellation during principal resolution is reported as cancelled without reading the source', async () => {
  const controller = new AbortController();
  const h = setup(async () => { controller.abort(); throw new SourceError('cancelled'); });
  await assert.rejects(h.wrapped.read(controller.signal), { code: 'cancelled' });
  assert.deepEqual(h.log, ['principal']);
});
