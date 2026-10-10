import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createSnapshot } from '../src/domain/usage.js';
import { createCli } from '../src/ui/cli/bootstrap.js';
import { processSignals } from '../src/ui/cli/runtime.js';

function launch() {
  return spawn(process.execPath, ['--import', 'tsx', 'src/main.ts', 'once'], {
    env: { ...process.env, YOROI_PROVIDERS: 'codex',
      YOROI_CODEX_PATH: '/yoroi-test-missing-executable' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('real CLI entry point returns 1 for missing executable without account access', { timeout: 3000 }, async () => {
  const child = launch();
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
  test(`once forwards ${signal} to the provider AbortSignal and removes its handler`, { timeout: 2000 }, async () => {
    const before = process.listenerCount(signal);
    let aborted = false;
    const cli = createCli({ env: { stdout: () => {}, stderr: () => {} },
      sources: [{ provider: 'codex', read: signal => new Promise(resolve => {
        signal?.addEventListener('abort', () => {
          aborted = signal.aborted;
          resolve(createSnapshot('codex', '2026-10-10T00:00:00Z', []));
        }, { once: true });
      }) }], subscribeSignals: processSignals });
    const pending = cli.run(['once']);
    assert.equal(process.listenerCount(signal), before + 1);
    process.emit(signal);
    assert.equal(await pending, 0);
    assert.equal(aborted, true);
    assert.equal(process.listenerCount(signal), before);
  });
}
