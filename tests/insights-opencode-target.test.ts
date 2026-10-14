import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { compose } from '../src/composition-root.js';
import { opencodeTarget } from '../src/config/load-config.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import type { ProcessRunner } from '../src/infra/process-port.js';
import { collectOpenCodeFreeModels } from '../src/insights/opencode-free-models.js';

test('YOROI_OPENCODE_TARGET defaults to v1, accepts v1|v2 and rejects anything else', () => {
  assert.equal(opencodeTarget({}), 'v1');
  assert.equal(opencodeTarget({ YOROI_OPENCODE_TARGET: '' }), 'v1');
  assert.equal(opencodeTarget({ YOROI_OPENCODE_TARGET: 'v2' }), 'v2');
  assert.throws(() => opencodeTarget({ YOROI_OPENCODE_TARGET: '2' }), /Invalid opencode target/);
});

test('v2 discovers free models with a private server; v1 keeps its original command', async () => {
  const calls: (readonly string[])[] = [];
  const runner: ProcessRunner = { run: async request => { calls.push(request.args); return { stdout: 'opencode/exo-free', stderr: '', exitCode: 0 }; } };
  const diagnostics: string[] = [];
  assert.deepEqual(await collectOpenCodeFreeModels(runner, { target: 'v2', diagnostic: line => diagnostics.push(line) }),
    [{ provider: 'opencode', originalId: 'opencode/exo-free', modelId: 'exo' }]);
  assert.deepEqual(diagnostics, []);
  assert.equal((await collectOpenCodeFreeModels(runner, { target: 'v1' })).length, 1); // v1은 기존 CLI 경로
  assert.deepEqual(calls, [['models', '--standalone'], ['models']]);
});

test('insights once rejects an unsupported YOROI_OPENCODE_TARGET as a config error (exit 2) before any collection', async (t: TestContext) => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-target-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  let fetches = 0, opened = 0; const stdout: string[] = [], stderr: string[] = [];
  const program = compose({ configEnv: { YOROI_DATA_DIR: dir, YOROI_OPENCODE_TARGET: 'v3' }, dataDir: dir,
    output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }, subscribeSignals: () => () => {},
    insights: { openHistory: () => { opened += 1; return Object.assign(new MemoryInsightHistory(), { close() {} }); },
      createPorts: () => [{ id: 'openrouter', fetch: async () => { fetches += 1; return {}; }, parse: () => [] }] } });
  assert.equal(await program.run(['insights', 'once']), 2);
  assert.deepEqual([fetches, opened, stdout, stderr], [0, 0, [], ['insights: Invalid opencode target']]);
});
