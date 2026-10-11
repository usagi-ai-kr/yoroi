import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryZenLockStore } from '../src/app/zen-lock-memory.js';
import { createCli } from '../src/ui/cli/bootstrap.js';
import { parseArgs } from '../src/ui/cli/args.js';
import { createSnapshot } from '../src/domain/usage.js';
import { renderZenFreeStatus, zenFreeRow } from '../src/ui/cli/zen-free.js';

function setup() {
  const stdout: string[] = []; const stderr: string[] = [];
  const store = new MemoryZenLockStore();
  const cli = createCli({ env: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) },
    sources: [{ provider: 'codex', read: async () => createSnapshot('codex', '2026-10-10T00:00:00Z', []) }],
    zenLockStore: store, subscribeSignals: () => () => {} });
  return { cli, store, stdout, stderr };
}

test('zen-free supports status, report, and help without configured providers', async () => {
  const { cli, stdout } = setup();
  assert.equal(await cli.run(['zen-free', 'report', '--exceeded', '--model', 'free']), 0);
  assert.match(stdout.at(-1) ?? '', /opencode-zen-free: locked free/);
  assert.equal(await cli.run(['zen-free', 'status']), 0);
  assert.equal(await cli.run(['zen-free', '--help']), 0);
  assert.match(stdout.at(-1) ?? '', /usage: yoroi zen-free/);
});

test('once adds a local OpenCode Zen row in plain and pretty output', async () => {
  const { cli, stdout } = setup();
  await cli.run(['once']);
  assert.ok(stdout.some(line => line.startsWith('opencode-zen-free: unknown')));
  stdout.length = 0;
  await cli.run(['once', '--pretty']);
  assert.ok(stdout.join('\n').includes('opencode-zen-free'));
});

test('zen-free parser rejects conflicting report actions', () => {
  assert.equal(parseArgs(['zen-free', 'report', '--exceeded', '--ok']).kind, 'error');
});

test('retry options validate values, reject duplicates, and status cannot write', () => {
  assert.equal(parseArgs(['zen-free', 'report', '--retry-in', '3600', '--exceeded']).kind, 'zen-free');
  assert.equal(parseArgs(['zen-free', 'report', '--retry-at', '2026-10-10T01:00:00Z', '--exceeded']).kind, 'zen-free');
  for (const args of [
    ['--retry-in', '0', '--exceeded'], ['--retry-in', 'nope', '--exceeded'],
    ['--retry-at', 'tomorrow', '--exceeded'], ['--retry-in', '2', '--retry-at', '2026-10-10T00:00:00.000Z', '--exceeded'],
    ['status', '--exceeded'], ['status', '--ok'],
  ]) assert.equal(parseArgs(['zen-free', ...args]).kind, 'error', args.join(' '));
});

test('once keeps provider output when local Zen lookup fails', async () => {
  const { stdout, stderr } = setup();
  const broken = { get: () => { throw new Error('private database detail'); },
    markExceeded: () => { throw new Error('unused'); }, markOk: () => ({ changed: false }), close: () => {} };
  const cli = createCli({ env: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) },
    sources: [{ provider: 'codex', read: async () => createSnapshot('codex', '2026-10-10T00:00:00Z', []) }],
    zenLockStore: broken, subscribeSignals: () => () => {} });
  assert.equal(await cli.run(['once']), 0);
  assert.ok(stdout.some(line => line.startsWith('codex: ok')));
  assert.deepEqual(stderr, []);
});

test('clear status hides retry and rendered model/reason are sanitized and bounded', async () => {
  const { cli, store, stdout } = setup();
  await cli.run(['zen-free', 'report', '--exceeded', '--model', `m\u001b[31m${'x'.repeat(80)}`,
    '--reason', `line\n${'r'.repeat(150)}`, '--retry-at', '2026-10-10T01:00:00.000Z']);
  await cli.run(['zen-free', 'report', '--ok']);
  const line = (stdout.at(-1) ?? '').split('\n')[0]!;
  assert.match(line, /opencode-zen-free: clear/);
  assert.ok(!line.includes('retry='));
  assert.ok(!/[\u0000-\u001f\u007f-\u009f]/.test(line));
  assert.ok(line.length < 250);
  store.close();
});

test('expired retry stays locked, shows retry passed, and hides retry_in', () => {
  const state = { scope: 'opencode-zen:free', state: 'locked' as const,
    retryAt: '2026-10-10T01:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' };
  const now = new Date('2026-10-10T01:00:01.000Z');
  const row = zenFreeRow(state, now);
  assert.equal(row.status, 'locked');
  assert.match(row.detail, /retry passed \(unverified\)/);
  assert.doesNotMatch(row.detail, /retry_in=/);
  assert.match(renderZenFreeStatus(state, now), /locked .*retry passed \(unverified\)/);
  assert.doesNotMatch(renderZenFreeStatus(state, now), /retry_in=/);
  assert.doesNotMatch(zenFreeRow(state, new Date('2026-10-10T01:00:00.000Z')).detail, /retry passed/);
  const futureRow = zenFreeRow(state, new Date('2026-10-10T00:30:00.000Z'));
  assert.match(futureRow.detail, /retry_in=30m/);
  assert.doesNotMatch(futureRow.detail, /retry passed/);
  assert.match(renderZenFreeStatus(state, new Date('2026-10-10T00:30:00.000Z')), /locked .*retry_in=30m/);
});

test('zen-free status and report display retry_in when locked with future retry', async () => {
  const { cli, stdout } = setup();
  assert.equal(await cli.run(['zen-free', 'report', '--exceeded', '--retry-in', '1800']), 0);
  assert.match(stdout.at(-1) ?? '', /retry_in=30m/);
  assert.equal(await cli.run(['zen-free', 'status']), 0);
  assert.match(stdout.at(-1) ?? '', /retry_in=30m/);
});
