import assert from 'node:assert/strict';
import test from 'node:test';
import { updateGlobal } from './update-global.mjs';

function fixture(overrides = {}) {
  const calls = []; const output = [];
  const run = (command, args) => {
    const key = [command, ...args].join(' '); calls.push(key);
    if (key in overrides) return overrides[key];
    return { status: 0, stdout: command === 'yoroi' ? '0.2.0\n' :
      args[0] === 'rev-list' ? '0\n' : args[0] === 'rev-parse' ? 'sha\n' : '' };
  };
  const invoke = args => updateGlobal({ args, version: '0.2.0', run,
    write: message => output.push(message) });
  return { calls, output, invoke };
}
const UPSTREAM = 'git rev-parse --verify --quiet refs/remotes/origin/main';
const BEHIND = 'git rev-list --count HEAD..origin/main';
test('update builds, reuses installer, then verifies PATH yoroi', () => {
  const f = fixture(); assert.equal(f.invoke([]), 0);
  assert.deepEqual(f.calls, ['git status --porcelain', UPSTREAM, BEHIND,
    'pnpm run build', 'pnpm run install:global', 'yoroi --version']);
  assert.deepEqual(f.output, ['repository=0.2.0 global=0.2.0']);
});
test('check is read-only and compares matching, differing, and missing versions', () => {
  for (const [result, code] of [[{ status: 0, stdout: '0.2.0\n' }, 0],
    [{ status: 0, stdout: '0.1.2\n' }, 1], [{ status: null, error: { code: 'ENOENT' } }, 2],
    [{ status: 1, stderr: 'SYNTHETIC_SECRET' }, 2], [{ status: 0, stdout: 'garbled' }, 2]]) {
    const f = fixture({ 'yoroi --version': result });
    assert.equal(f.invoke(['--check']), code); assert.deepEqual(f.calls, ['yoroi --version']);
    assert.ok(!f.output.join('\n').includes('SYNTHETIC_SECRET'));
  }
});
test('dirty, behind, and unknown Git state warn; strict stops before build', () => {
  for (const overrides of [
    { 'git status --porcelain': { status: 0, stdout: ' M synthetic.env' } },
    { [BEHIND]: { status: 0, stdout: '2\n' } },
    { [BEHIND]: { status: 128, stderr: 'SYNTHETIC_SECRET' } },
    { 'git status --porcelain': { status: null } },
  ]) {
    const loose = fixture(overrides); assert.equal(loose.invoke([]), 0);
    assert.ok(loose.output.some(message => message.startsWith('Warning:')));
    const strict = fixture(overrides); assert.equal(strict.invoke(['--strict']), 1);
    assert.ok(!strict.calls.some(command => command.startsWith('pnpm')));
    assert.ok(!loose.output.join('\n').includes('SYNTHETIC_SECRET'));
    assert.ok(!loose.output.join('\n').includes('synthetic.env'));
  }
});
test('missing origin/main ref notes once, skips behind, and does not fail strict', () => {
  for (const missing of [{ status: 128, stderr: 'SYNTHETIC_SECRET' }, { status: 1 }]) {
    for (const args of [[], ['--strict']]) {
      const f = fixture({ [UPSTREAM]: missing });
      assert.equal(f.invoke(args), 0);
      const notes = f.output.filter(message => message.startsWith('Note:'));
      assert.equal(notes.length, 1); assert.ok(notes[0].includes('behind check skipped'));
      assert.ok(!f.calls.includes(BEHIND));
      assert.ok(f.calls.includes('pnpm run build'));
      assert.ok(!f.output.join('\n').includes('SYNTHETIC_SECRET'));
      assert.ok(!f.output.some(message => message.startsWith('Warning:')));
    }
  }
});
test('--check with --strict states that strict is ignored and stays read-only', () => {
  const f = fixture(); assert.equal(f.invoke(['--check', '--strict']), 0);
  assert.deepEqual(f.calls, ['yoroi --version']);
  assert.ok(f.output.includes('Note: --strict is ignored with --check'));
  const single = fixture(); assert.equal(single.invoke(['--check']), 0);
  assert.ok(!single.output.some(message => message.includes('--strict')));
});
test('update fails on build/install failure and never exposes child diagnostics', () => {
  for (const script of ['build', 'install:global']) {
    const f = fixture({ [`pnpm run ${script}`]: { status: 1,
      stdout: 'SYNTHETIC_SECRET', stderr: 'SYNTHETIC_SECRET' } });
    assert.equal(f.invoke([]), 1); assert.ok(!f.calls.includes('yoroi --version'));
    if (script === 'build') assert.ok(!f.calls.includes('pnpm run install:global'));
    assert.ok(!f.output.join('\n').includes('SYNTHETIC_SECRET'));
  }
});
test('post-install mismatch or unverifiable version exits 1', () => {
  for (const result of [{ status: 0, stdout: '0.1.2' }, { status: null }]) {
    const f = fixture({ 'yoroi --version': result }); assert.equal(f.invoke([]), 1);
    assert.ok(f.calls.includes('pnpm run install:global'));
  }
});
test('unknown flags/help do not execute commands; injected runner exceptions are contained', () => {
  const f = fixture(); assert.equal(f.invoke(['--unknown']), 2);
  assert.equal(f.invoke(['--help']), 0); assert.deepEqual(f.calls, []);
  const output = [];
  assert.equal(updateGlobal({ args: ['--check'], version: '0.2.0',
    run() { throw new Error('SYNTHETIC_SECRET'); }, write: s => output.push(s) }), 2);
  assert.ok(!output.join('\n').includes('SYNTHETIC_SECRET'));
});
