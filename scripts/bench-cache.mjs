// Run: node --import tsx scripts/bench-cache.mjs > /tmp/yoroi-cache-bench.json
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, cpus, platform, release } from 'node:os';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { collectOnce } from '../src/app/collect-once.ts';
import { CachedSource } from '../src/app/cached-source.ts';
import { createSnapshot, providers } from '../src/domain/usage.ts';
import { openUsagePersistence } from '../src/composition/cache.ts';
import { loadSqlite } from '../src/infra/sqlite/database.ts';

if (process.argv[2] === '--lock') {
  const db = new (loadSqlite().DatabaseSync)(process.argv[3]);
  db.exec('BEGIN IMMEDIATE'); process.send('locked');
  process.on('message', () => { db.exec('ROLLBACK'); db.close(); process.disconnect(); });
} else {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-cache-bench-'));
  const warmup = 20, n = 200, delays = [2, 4, 8, 16, 32], names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const env = dir => ({ HOME: root, YOROI_DATA_DIR: join(root, dir) });
  const key = provider => ({ provider, lookup: 'windows:all', scope: 'synthetic', contractVersion: 'v1' });
  const snapshot = (provider, now) => createSnapshot(provider, new Date(now).toISOString(),
    [{ id: 'synthetic-window', unit: 'tokens', used: 20, limit: 100 }]);
  const stats = Object.fromEntries(names.map(name => [name, { wall: [], loop: [], calls: 0 }]));
  const summary = values => {
    const sorted = [...values].sort((a, b) => a - b), q = p => sorted[Math.ceil(p * sorted.length) - 1];
    return { p50: q(.5), p95: q(.95), p99: q(.99), max: sorted.at(-1) };
  };
  let locker, locked, cancelled = false;
  process.on('SIGINT', () => { cancelled = true; });
  try {
    for (const name of ['C', 'D', 'E']) openUsagePersistence(env(name)).close();
    writeFileSync(join(root, 'F'), 'synthetic parent is a file');
    locked = openUsagePersistence(env('G'));
    for (const provider of providers.slice(0, 4)) locked.cache.set(key(provider), snapshot(provider, Date.parse('2026-01-01T00:00:00Z')));
    locker = fork(new URL(import.meta.url), ['--lock', join(root, 'G', 'yoroi.db')],
      { execArgv: ['--import', 'tsx'], env: { ...process.env, HOME: root, YOROI_DATA_DIR: root }, silent: true });
    assert.deepEqual((await once(locker, 'message'))[0], 'locked');
    for (let round = -warmup; round < n; round++) {
      if (cancelled) throw new Error('Benchmark cancelled');
      const offset = (round + warmup) % names.length;
      for (const name of [...names.slice(offset), ...names.slice(0, offset)]) {
        const now = Date.parse('2026-01-01T00:00:00Z') + (round + warmup) * 100;
        let calls = 0, persistence;
        const sources = providers.map((provider, i) => ({ provider, async read() {
          calls++; await sleep(delays[i] + ((round + warmup + i) % 4)); return snapshot(provider, now);
        } }));
        if (name === 'B') rmSync(join(root, 'B'), { recursive: true, force: true });
        if (['C', 'D', 'E'].includes(name)) {
          const prepare = openUsagePersistence(env(name));
          for (const [i, provider] of providers.entries()) prepare.cache.set(key(provider),
            snapshot(provider, now - (name === 'C' || (name === 'E' && i === 4) ? 60_000 : 0)));
          prepare.close();
        }
        const histogram = monitorEventLoopDelay({ resolution: 1 }); histogram.enable(); await sleep(2);
        const start = performance.now();
        try { if (name !== 'A') persistence = name === 'G' ? locked : openUsagePersistence(env(name)); }
        catch { assert.equal(name, 'F'); }
        const wrapped = persistence ? sources.map(source => new CachedSource(source,
          { ...persistence, key: key(source.provider), clock: () => now })) : sources;
        const results = await collectOnce(wrapped);
        if (persistence && name !== 'G') persistence.close();
        const wall = performance.now() - start;
        await sleep(2); histogram.disable();
        assert.deepEqual(results, providers.map((provider, i) => ({ provider,
          snapshot: snapshot(provider, name === 'G' && i < 4 ? Date.parse('2026-01-01T00:00:00Z') : now) })));
        assert.equal(calls, name === 'D' ? 0 : ['E', 'G'].includes(name) ? 1 : 5);
        if (round >= 0) { stats[name].wall.push(wall); stats[name].loop.push(histogram.percentile(99) / 1e6); stats[name].calls += calls; }
      }
      if ((round + 1) % 20 === 0) process.stderr.write(`round ${round + 1}/${n}\n`);
    }
    locker.send('release'); await once(locker, 'exit'); locker = undefined; locked.close(); locked = undefined;
    const verify = openUsagePersistence(env('G'));
    assert.equal(verify.cache.get(key(providers[4]), Date.parse('2026-01-01T00:00:22Z')), undefined); verify.close();
    console.log(JSON.stringify({ machine: { cpu: cpus()[0]?.model, cores: cpus().length, platform: platform(),
      osRelease: release(), node: process.version }, n, warmup, delaysMs: delays, jitterMs: [0, 1, 2, 3],
      order: 'rotating A..G each round', results: Object.fromEntries(names.map(name => [name,
        { wallMs: summary(stats[name].wall), trialLoopP99Ms: summary(stats[name].loop), externalCalls: stats[name].calls }])) }, null, 2));
  } finally {
    if (locker) { const exited = once(locker, 'exit'); locker.kill('SIGKILL'); await exited; }
    locked?.close(); rmSync(root, { recursive: true, force: true });
  }
}
