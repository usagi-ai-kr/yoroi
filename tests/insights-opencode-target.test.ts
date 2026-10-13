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
import { OPENCODE_V2_UNVERIFIED_DIAGNOSTIC } from '../src/insights/opencode-models-source.js';

test('YOROI_OPENCODE_TARGET defaults to v1, accepts v1|v2 and rejects anything else', () => {
  assert.equal(opencodeTarget({}), 'v1');
  assert.equal(opencodeTarget({ YOROI_OPENCODE_TARGET: '' }), 'v1');
  assert.equal(opencodeTarget({ YOROI_OPENCODE_TARGET: 'v2' }), 'v2');
  assert.throws(() => opencodeTarget({ YOROI_OPENCODE_TARGET: '2' }), /Invalid opencode target/);
});

test('v2 target is an unverified stub: no CLI call, empty list and exactly one diagnostic', async () => {
  let calls = 0;
  const runner: ProcessRunner = { run: async () => { calls += 1; return { stdout: 'opencode/exo-free', stderr: '', exitCode: 0 }; } };
  const diagnostics: string[] = [];
  assert.deepEqual(await collectOpenCodeFreeModels(runner, { target: 'v2', diagnostic: line => diagnostics.push(line) }), []);
  assert.deepEqual([calls, diagnostics], [0, [OPENCODE_V2_UNVERIFIED_DIAGNOSTIC]]);
  assert.equal((await collectOpenCodeFreeModels(runner, { target: 'v1' })).length, 1); // v1은 기존 CLI 경로
  assert.equal(calls, 1);
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
