import assert from 'node:assert/strict';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import { MemoryZenLockStore } from '../../src/app/zen-lock-memory.js';
import { createCli } from '../../src/ui/cli/bootstrap.js';
import { createSnapshot } from '../../src/domain/usage.js';

const state = { store: new MemoryZenLockStore(), out: [] as string[], code: 0 };
Before(() => { state.store = new MemoryZenLockStore(); state.out = []; state.code = 0; });
async function run(argv: string[]): Promise<void> {
  const cli = createCli({ env: { stdout: line => state.out.push(line), stderr: line => state.out.push(line) },
    sources: [{ provider: 'codex', read: async () => createSnapshot('codex', '2026-10-10T00:00:00Z', []) }],
    zenLockStore: state.store, subscribeSignals: () => () => {} });
  state.code = await cli.run(argv);
}
When('I report Zen free exceeded for model {string}', async (model: string) =>
  run(['zen-free', 'report', '--exceeded', '--model', model]));
When('I read Zen free status', async () => run(['zen-free', 'status']));
Given('Zen free is locally clear', async () => { await run(['zen-free', 'report', '--exceeded']); await run(['zen-free', 'report', '--ok']); });
When('I run Zen free once in pretty mode', async () => run(['once', '--pretty']));
When('the OpenCode plugin reports that it loaded', async () => run(['zen-free', 'report', '--loaded']));
When('I open Zen free help', async () => run(['zen-free', '--help']));
Then('the Zen free status is {string}', (expected: string) => {
  assert.ok(state.out.join('\n').includes(`opencode-zen-free: ${expected}`));
});
Then('the Zen free output contains {string}', (expected: string) => assert.ok(state.out.join('\n').includes(expected)));
Then('the Zen free exit code is {int}', (expected: number) => assert.equal(state.code, expected));
