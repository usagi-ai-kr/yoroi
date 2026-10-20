import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { NodeProcessRunner } from '../src/infra/process-runner.js';

const node = process.execPath;
const opts = { timeoutMs: 30000, envMode: 'replace' as const, env: {} };

test('cwd: actual child cwd equals requested directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-cwd-')); try {
    const out = await new NodeProcessRunner().run(
      { executable: node, args: ['-p', 'process.cwd()'], ...opts, cwd: dir });
    assert.equal(out.exitCode, 0);
    assert.equal(out.stdout.trim(), (await import('node:fs')).realpathSync(dir));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('cwd omitted: child inherits parent cwd', async () => {
  const out = await new NodeProcessRunner().run(
    { executable: node, args: ['-p', 'process.cwd()'], ...opts });
  assert.equal(out.stdout.trim(), process.cwd());
});

test('cwd: file artifact lands in requested directory, not repo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-cwd-artifact-')); try {
    const out = await new NodeProcessRunner().run({ executable: node,
      args: ['-e', "require('fs').writeFileSync('cwd-probe.txt','x')"], ...opts, cwd: dir });
    assert.equal(out.exitCode, 0);
    assert.ok(existsSync(join(dir, 'cwd-probe.txt')), 'artifact in cwd');
    assert.ok(!existsSync(join(process.cwd(), 'cwd-probe.txt')), 'nothing leaked to repo');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('cwd missing: reports unavailable, not a missing executable', async () => {
  const missing = join(tmpdir(), 'yoroi-cwd-missing-', String(process.pid));
  await assert.rejects(
    new NodeProcessRunner().run({ executable: node, args: ['-p', '1'], ...opts, cwd: missing }),
    (e: { code?: string }) => e.code === 'unavailable',
  );
});

test('calibration wiring passes sandbox dir as request cwd', async () => {
  const { runCalibrationTask } = await import('../src/insights/calibration-runner.js');
  const { CALIBRATION_TASKS_V2 } = await import('../src/insights/calibration-task-set.js');
  let seen: string | undefined;
  const fake = { run: async (req: { cwd?: string }) => { seen = req.cwd; return { stdout: '', stderr: '', exitCode: 0 }; } };
  await runCalibrationTask(CALIBRATION_TASKS_V2[0]!, { runner: fake as never, modelOriginalId: 'opencode/test-free' });
  assert.ok(seen !== undefined && seen.length > 0, 'cwd is set to sandbox dir');
  assert.ok(!existsSync(seen), 'sandbox cleaned up afterwards');
});
