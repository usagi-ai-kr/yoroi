import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MemoryDetectStateStore } from '../src/app/detect-state-memory.js';
import { detectZen } from '../src/app/detect-zen.js';
import { MemoryZenLockStore } from '../src/app/zen-lock-memory.js';
import { runDetectCli } from '../src/composition/detect-cli.js';
import { noOpencodeProcess, opencodeStartedAtMs, parseEtime, type SyncProcessRun } from '../src/infra/opencode-process.js';

const NOW = Date.parse('2026-10-11T00:00:00Z');
/** `ps -axo etime=,comm=` as macOS and procps print it: [[dd-]hh:]mm:ss, right-aligned. */
const PS = ['    02:00 /usr/local/bin/node\n', ' 01:00:00 /Applications/OpenCode.app/Contents/MacOS/OpenCode\n',
  '    01:30 /Users/x/.opencode/bin/opencode\n', '05-03:28:00 /sbin/launchd\n', '    00:42 /usr/bin/curl\n', '\n'];

test('the probe reads the newest OpenCode start from etime output and ignores everything else', () => {
  assert.equal(opencodeStartedAtMs(() => PS.join(''), () => NOW)(), NOW - 90_000, 'smallest elapsed time = newest process');
  assert.equal(opencodeStartedAtMs(() => '       04:40:31 opencode\n   05-03:27:24 opencode\n', () => NOW)(), NOW - (4 * 3600 + 40 * 60 + 31) * 1000);
});
test('etime parsing: mm:ss, hh:mm:ss and dd-hh:mm:ss; anything else is not a time', () => {
  assert.deepEqual(['01:30', '01:00:00', '05-03:28:00', '00:00', '1-00:00:01'].map(parseEtime), [90, 3600, 5 * 86_400 + 3 * 3600 + 28 * 60, 0, 86_401]);
  for (const bad of ['', 'abc', '1', '00:75', '1:2:3:4', '-5', '12:60:00', 'etimes']) assert.equal(parseEtime(bad), undefined, bad);
});
test('the probe matches the process name, not a path that merely contains it', () => {
  assert.equal(opencodeStartedAtMs(() => '   08:20 /Users/x/yoroi/opencode-notes/src/cli.js\n', () => NOW)(), undefined);
  assert.equal(opencodeStartedAtMs(() => '   08:20 /opt/homebrew/bin/OpenCode\n', () => NOW)(), NOW - 500_000, 'case-insensitive name match');
});
test('no process, a failure, or garbage all mean "omit", never a guess', () => {
  for (const out of ['   02:00 /usr/bin/curl\n', '', 'garbage\nnope\n', '  500 /opt/homebrew/bin/opencode\n']) assert.equal(opencodeStartedAtMs(() => out, () => NOW)(), undefined, JSON.stringify(out));
  assert.equal(opencodeStartedAtMs(() => { throw new Error('ps missing'); }, () => NOW)(), undefined);
  assert.equal(noOpencodeProcess(), undefined);
});
test('the probe passes only the fixed portable ps arguments', () => {
  const calls: unknown[][] = []; const runner: SyncProcessRun = (...args) => { calls.push(args); return PS.join(''); };
  opencodeStartedAtMs(runner, () => NOW)();
  assert.deepEqual(calls, [['ps', ['-axo', 'etime=,comm='], 2000]], 'no user arguments, session files, conversation content or env');
});
test('the default runner discards the child stderr, so a failing ps never writes into detect diagnostics', () => {
  const code = `const { runPs } = await import('./src/infra/opencode-process.ts');
    try { runPs('/bin/sh', ['-c', 'echo CHILD-STDERR-MARKER >&2; exit 3'], 2000); } catch { console.log('threw'); }`;
  const out = spawnSync(process.execPath, ['--import', 'tsx', '-e', code], { encoding: 'utf8' });
  assert.equal(out.stdout.trim(), 'threw'); assert.ok(!out.stderr.includes('CHILD-STDERR-MARKER'), out.stderr);
});
test('one unchanged OpenCode process reports plugin-stale once even with second-floored, jittery start times', () => {
  const trueStart = Date.parse('2026-10-11T00:00:59.700Z'), state = new MemoryDetectStateStore(), lock = new MemoryZenLockStore();
  const events: string[] = [];
  for (let k = 0; k < 6; k++) {   // the start straddles a minute edge on purpose; cycles ~10 minutes apart with ms jitter
    const now = trueStart + 20 * 60_000 + k * 600_000 + k * 137 + (k % 2) * 400;
    const sec = Math.floor((now - trueStart) / 1000), pad = (n: number) => String(n).padStart(2, '0');
    const ps = () => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)} /opt/homebrew/bin/opencode\n`;
    const started = opencodeStartedAtMs(ps, () => now + 5)();
    events.push(...detectZen({ lock, state, nowMs: now, ...(started !== undefined && { opencodeStartedAtMs: started }), pluginStaleGraceMs: 600_000 }).map(e => e.kind));
  }
  assert.deepEqual(events, ['plugin-stale']);
});
test('a plugin loaded right after the process start is never reported stale, even when the estimated start is up to a second late', () => {
  const trueStart = Date.parse('2026-10-11T00:10:20.100Z'), lock = new MemoryZenLockStore(), state = new MemoryDetectStateStore();
  lock.markLoaded({ scope: 'opencode-zen:free', observedAt: new Date(trueStart + 300).toISOString() });   // loaded 0.3 s after start
  const started = opencodeStartedAtMs(() => '30:00 /opt/homebrew/bin/opencode\n', () => trueStart + 1_800_900)();   // estimate = start + 0.8 s
  assert.deepEqual(detectZen({ lock, state, nowMs: trueStart + 1_800_900, opencodeStartedAtMs: started!, pluginStaleGraceMs: 600_000 }), []);
  const old = new MemoryZenLockStore(); old.markLoaded({ scope: 'opencode-zen:free', observedAt: new Date(trueStart - 120_000).toISOString() });
  assert.deepEqual(detectZen({ lock: old, state: new MemoryDetectStateStore(), nowMs: trueStart + 1_800_900, opencodeStartedAtMs: started!, pluginStaleGraceMs: 600_000 }).map(e => e.kind), ['plugin-stale']);
});
test('detect-cli forwards the probe result and runs exactly one read-only ps per cycle', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-probe-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dataEnv = { YOROI_DATA_DIR: dir }, configEnv = { ...dataEnv, YOROI_PROVIDERS: 'opencode-go', HOME: dir };
  const psCalls: string[][] = [];
  const sleep = async (): Promise<void> => { throw new Error('stop-after-first-cycle'); };   // one cycle, then stop
  try { await runDetectCli({ kind: 'detect' } as never, { env: { stdout: () => {}, stderr: () => {} }, configEnv, dataEnv,
    subscribeSignals: () => () => {}, options: { now: () => NOW, intervalMs: 10 * 60_000, sleep, owner: 'detector-a',
      runProcess: (exe, args) => { psCalls.push([exe, ...args]); return PS.join(''); } } }); } catch { /* sentinel */ }
  assert.deepEqual(psCalls, [['ps', '-axo', 'etime=,comm=']]);
});
