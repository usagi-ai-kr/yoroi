import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { leaseTtlMs } from '../src/app/detect-state-port.js';
import { SourceError } from '../src/app/usage-source.js';
import { compose } from '../src/composition-root.js';
import { createSnapshot } from '../src/domain/usage.js';
import { openDetectStateStore } from '../src/infra/sqlite/detect-state-store.js';
import { openZenLockStore } from '../src/infra/sqlite/zen-lock-store.js';

const T0 = Date.parse('2026-10-11T00:00:00Z'), INTERVAL = 600_000;
function harness(t: TestContext, providers = 'codex') {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-detect-cli-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sim = { now: T0, reads: 0, percent: 100, handler: undefined as (() => void) | undefined, sleeps: [] as number[] };
  const out: string[] = [], err: string[] = [], configEnv = { YOROI_DATA_DIR: dir, YOROI_PROVIDERS: providers, HOME: dir };
  const factories = { codex: () => ({ provider: 'codex' as const, read: async () => { sim.reads++;
    return createSnapshot('codex', new Date(sim.now).toISOString(), [{ id: 'weekly', unit: 'percent', percent: sim.percent, resetAt: '2026-10-18T00:00:00Z' }]); } }) };
  const run = (argv: string[], over: Record<string, unknown> = {}, sleepAfter = 0) => compose({ configEnv, output: { stdout: s => out.push(s), stderr: s => err.push(s) },
    subscribeSignals: handler => { sim.handler = handler; return () => { sim.handler = undefined; }; },
    detect: { now: () => sim.now, owner: 'detector-test', runProcess: () => '', cycle: { factories, platform: 'linux' },
      sleep: async (ms: number) => { sim.sleeps.push(ms); sim.now += ms; if (sim.sleeps.length >= sleepAfter) sim.handler?.(); }, ...over } }).run(argv);
  return { sim, out, err, run, dir, configEnv };
}

test('argument errors exit 2, help exits 0 with detect usage, and watch keeps its removal guidance', async t => {
  const h = harness(t);
  for (const argv of [['detect', '--bogus'], ['detect', 'status', '--once'], ['detect', '--json', '--json'], ['detect', 'status', 'status'], ['watch']]) assert.equal(await h.run(argv), 2, argv.join(' '));
  assert.match(h.err.join('\n'), /watch command removed; use yoroi once/); assert.equal(h.sim.reads, 0);
  h.out.length = 0; assert.equal(await h.run(['detect', '--help']), 0); assert.match(h.out.join('\n'), /usage: yoroi detect/); assert.doesNotMatch(h.out.join('\n'), /launchd|pm2|\/Users/);
  assert.equal(await harness(t, 'nope').run(['detect', '--once']), 2);
});
test('--once runs one cycle: events on stdout only, no diagnostics, lease released, no paths or secrets', async t => {
  const h = harness(t);
  assert.equal(await h.run(['detect', '--once']), 0);
  assert.equal(h.out.length, 1); assert.match(h.out[0]!, /^2026-10-11T00:00:00\.000Z usage codex\/weekly exhausted percent=100/);
  assert.deepEqual(h.err, []); assert.ok(![...h.out, ...h.err].join('\n').includes(h.dir));
  const store = openDetectStateStore(h.configEnv); t.after(() => store.close()); assert.equal(store.getLease(), undefined);
  assert.equal(await h.run(['detect', '--once']), 0); assert.equal(h.out.length, 1); assert.equal(h.sim.reads, 1);
});
test('p45 target v2: ps를 호출하지 않고 마커 버전으로 stale을 판정한다', async t => {
  let ps = 0;
  const h = harness(t); (h.configEnv as Record<string, string>).YOROI_OPENCODE_TARGET = 'v2';
  assert.equal(await h.run(['detect', '--once'], { runProcess: () => { ps += 1; return '00:01 /usr/local/bin/opencode'; } }), 0);
  assert.equal(ps, 0); // v2는 ps 미사용
  assert.match(h.out.join('\n'), /plugin-stale marker=v2/);
  h.out.length = 0; (h.configEnv as Record<string, string>).YOROI_OPENCODE_TARGET = 'v3';
  assert.equal(await h.run(['detect', '--once']), 2); // 잘못된 target은 exit 2
});
test('--json prints one JSON object per event with its source and nothing else', async t => {
  const h = harness(t); h.sim.percent = 40; await h.run(['detect', '--once', '--json']); assert.deepEqual(h.out, []);
  h.sim.percent = 100; h.sim.now += 31 * 60_000; assert.equal(await h.run(['detect', '--once', '--json']), 0);
  const events = h.out.map(line => JSON.parse(line) as { source: string; kind: string; windowId: string });
  assert.deepEqual(events.map(e => [e.source, e.kind, e.windowId]), [['usage', 'exhausted', 'weekly'], ['usage', 'surge', 'weekly']]);
});
test('the foreground loop runs every 600s (the default) from one start, reports an event once, stops on a signal and frees the lease', async t => {
  const h = harness(t);
  assert.equal(await h.run(['detect'], {}, 3), 0);
  assert.deepEqual(h.sim.sleeps, [INTERVAL, INTERVAL, INTERVAL]);
  assert.equal(h.out.filter(line => line.includes('exhausted')).length, 1); assert.equal(h.sim.reads, 1); assert.deepEqual(h.err, []);
  const store = openDetectStateStore(h.configEnv); t.after(() => store.close()); assert.equal(store.getLease(), undefined);
});
test('status reports running, stopped and no-detector states (plain and JSON) without exposing the owner', async t => {
  const h = harness(t); assert.equal(await h.run(['detect', 'status']), 0); assert.match(h.out.at(-1)!, /no active detector/);
  const store = openDetectStateStore(h.configEnv); t.after(() => store.close());
  store.acquireLease('detector-other', T0, leaseTtlMs(INTERVAL));
  h.sim.now = T0 + 2 * 60_000; await h.run(['detect', 'status']); assert.match(h.out.at(-1)!, /^detect: running last-heartbeat=2026-10-11T00:00:00\.000Z age=2m/);
  h.sim.now = T0 + 11 * 60_000; await h.run(['detect', 'status']); assert.match(h.out.at(-1)!, /^detect: running .* age=11m/);
  h.sim.now = T0 + 21 * 60_000; await h.run(['detect', 'status', '--json']);
  assert.deepEqual(JSON.parse(h.out.at(-1)!), { state: 'stopped', lastHeartbeatAt: new Date(T0).toISOString(), ageMs: 21 * 60_000, expiresAt: new Date(T0 + 1_200_000).toISOString() });
  assert.ok(!h.out.join('').includes('detector-other'));
});
test('a live detector elsewhere is reported on stderr once; component errors are codes only and never fail the run', async t => {
  const h = harness(t); const store = openDetectStateStore(h.configEnv); t.after(() => store.close());
  store.acquireLease('detector-other', T0, leaseTtlMs(INTERVAL));
  assert.equal(await h.run(['detect'], {}, 2), 0); assert.deepEqual(h.out, []); assert.deepEqual(h.err, ['detect: another detector holds the lease; waiting for it to expire']);
  store.releaseLease('detector-other'); h.err.length = 0; h.sim.sleeps.length = 0;
  const broken = { openPersistence: () => { throw new SourceError('parse'); } };
  assert.equal(await h.run(['detect', '--once'], { cycle: { factories: undefined, platform: 'linux', ...broken } }), 0);
  assert.deepEqual(h.err, ['detect: usage:open']);
});
test('the real entry point loops, reports diagnostics on stderr, exits 0 on SIGTERM and frees the lease', { timeout: 20_000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-detect-proc-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  // The real entry point runs the real ps: mark a far-future plugin load so a running OpenCode on this machine is never stale.
  const zen = openZenLockStore({ YOROI_DATA_DIR: dir }); zen.markLoaded!({ scope: 'opencode-zen:free', observedAt: '2099-01-01T00:00:00.000Z' }); zen.close();
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts', 'detect'], { stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, YOROI_DATA_DIR: dir, YOROI_PROVIDERS: 'codex', YOROI_CODEX_PATH: '/yoroi-test-missing-executable' } });
  let stdout = '', stderr = '';
  child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
  const closed = new Promise<number | null>(resolve => child.on('close', resolve));
  for (let i = 0; i < 150 && !stderr.includes('detect: usage:codex:not-installed'); i++) await new Promise(r => setTimeout(r, 100));
  assert.match(stderr, /detect: usage:codex:not-installed/); child.kill('SIGTERM');
  assert.equal(await closed, 0); assert.equal(stdout, ''); assert.ok(!(stdout + stderr).includes(dir));
  const store = openDetectStateStore({ YOROI_DATA_DIR: dir }); t.after(() => store.close()); assert.equal(store.getLease(), undefined);
});
