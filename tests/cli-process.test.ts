import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';

function launch(command: string) {
  return spawn(process.execPath, ['--import', 'tsx', 'src/main.ts', command], {
    env: { ...process.env, YOROI_PROVIDERS: 'codex',
      YOROI_CODEX_PATH: '/yoroi-test-missing-executable', YOROI_INTERVAL_SECONDS: '60' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
test('real CLI entry point returns 1 for missing executable without account access', { timeout: 3000 }, async () => {
  const child = launch('once');
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += String(chunk); });
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.on('error', reject); child.on('close', resolve);
    });
    assert.equal(code, 1);
    assert.match(stdout, /codex: error \[not-installed\]/);
    assert.equal(stderr, '');
  } finally { child.kill('SIGKILL'); }
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  test(`real watch CLI handles ${signal} while sleeping and exits normally`, { timeout: 3000 }, async () => {
    const child = launch('watch');
    let stdout = '';
    child.stdout.on('data', chunk => {
      stdout += String(chunk);
      if (stdout.includes('error [not-installed]')) child.kill(signal);
    });
    try {
      const [code, exitSignal] = await new Promise<[number | null, string | null]>((resolve, reject) => {
        child.on('error', reject); child.on('close', (code, exitSignal) => resolve([code, exitSignal]));
      });
      assert.equal(code, 0);
      assert.equal(exitSignal, null);
      assert.equal(stdout.split('\n').filter(Boolean).length, 1);
    } finally { child.kill('SIGKILL'); }
  });
}
