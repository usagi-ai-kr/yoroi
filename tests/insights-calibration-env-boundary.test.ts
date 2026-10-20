import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSandboxEnv } from '../src/insights/calibration-env.js';
import { NodeProcessRunner } from '../src/infra/process-runner.js';

/** 합성 표식(실제 비밀 아님). 결과 출력에는 존재 boolean만 쓴다. */
const SECRET = 'SYNTH-SECRET-abc123';
const TOKEN = 'SYNTH-TOKEN-xyz789';
const FAKE_HOME = '/nonexistent-synth-home-xyz';

test('real spawn boundary drops synthetic secrets and host config paths', async () => {
  const prev = new Map<string, string | undefined>();
  const setEnv = (k: string, v: string) => { prev.set(k, process.env[k]); process.env[k] = v; };
  setEnv('YOROI_SYNTH_SECRET', SECRET);
  setEnv('YOROI_UNRELATED_TOKEN', TOKEN);
  setEnv('NODE_OPTIONS', '--synth-flag');
  setEnv('HOME', FAKE_HOME);
  try {
    const env = buildSandboxEnv({ CALIBRATION_TASK_ID: 'task-1' }, '/tmp/synth-home');
    const runner = new NodeProcessRunner();
    const out = await runner.run({ executable: '/usr/bin/env', args: [], timeoutMs: 10000, env, envMode: 'replace' });
    assert.equal(out.exitCode, 0);
    const text = out.stdout;
    assert.ok(!text.includes(SECRET) && !text.includes(TOKEN), 'synthetic secrets absent');
    assert.ok(!text.includes('--synth-flag'), 'NODE_OPTIONS absent');
    assert.ok(!text.includes(FAKE_HOME), 'host HOME absent');
    assert.ok(text.includes('CALIBRATION_TASK_ID=task-1'), 'allowed task field kept');
    assert.ok(text.includes('GIT_DIR=/dev/null') && text.includes('ALLOW_NETWORKING=0'), 'forced hints present');
    assert.ok(text.includes('HOME=/tmp/synth-home'), 'isolated HOME kept');
    assert.ok(/^PATH=/m.test(text), 'exec PATH kept');
  } finally {
    for (const [k, v] of prev) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test('extra allowlist drops non-listed keys and cannot override forced hints', () => {
  const env = buildSandboxEnv({ CALIBRATION_TASK_ID: 't', SOME_AUTH_KEY: 'x', HOME: '/evil', NODE_OPTIONS: '--evil', GIT_DIR: '/real', ALLOW_NETWORKING: '1' });
  assert.equal(env.CALIBRATION_TASK_ID, 't');
  assert.ok(!('SOME_AUTH_KEY' in env) && !('NODE_OPTIONS' in env) && env.HOME !== '/evil', 'only listed keys pass');
  assert.equal(env.GIT_DIR, '/dev/null');
  assert.equal(env.GIT_WORK_TREE, '/dev/null');
  assert.equal(env.ALLOW_NETWORKING, '0');
  assert.equal(env.CALIBRATION_SANDBOX, '1');
});
