import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { After, Before, Given, Then, When } from '@cucumber/cucumber';
import { DEFAULT_DETECT_INTERVAL_MS } from '../../src/app/detect-scheduler.js';
import { leaseTtlMs } from '../../src/app/detect-state-port.js';
import { compose } from '../../src/composition-root.js';
import { createSnapshot } from '../../src/domain/usage.js';
import { openDetectStateStore } from '../../src/infra/sqlite/detect-state-store.js';

const NOW = Date.parse('2026-10-11T00:00:00Z');
const world = { dir: '', percent: 40, out: [] as string[], err: [] as string[], code: -1 };
Before(() => { world.dir = mkdtempSync(join(tmpdir(), 'yoroi-detect-bdd-')); Object.assign(world, { percent: 40, out: [], err: [], code: -1 }); });
After(() => { rmSync(world.dir, { recursive: true, force: true }); });

async function run(argv: string[]): Promise<void> {
  const factories = { codex: () => ({ provider: 'codex' as const, read: async () => createSnapshot('codex', new Date(NOW).toISOString(),
    [{ id: 'weekly', unit: 'percent', percent: world.percent, resetAt: '2026-10-18T00:00:00Z' }]) }) };
  world.code = await compose({ configEnv: { YOROI_DATA_DIR: world.dir, YOROI_PROVIDERS: 'codex', HOME: world.dir },
    output: { stdout: line => world.out.push(line), stderr: line => world.err.push(line) }, subscribeSignals: () => () => {},
    detect: { now: () => NOW, owner: 'detector-bdd', runProcess: () => '', cycle: { factories, platform: 'linux' } } }).run(argv);
}
Given('a Codex window that is at 100 percent', () => { world.percent = 100; });
Given('another detector holds a live lease', () => {
  const store = openDetectStateStore({ YOROI_DATA_DIR: world.dir });
  try { store.acquireLease('detector-other', NOW, leaseTtlMs(DEFAULT_DETECT_INTERVAL_MS)); } finally { store.close(); }
});
When('I run detect once', async () => run(['detect', '--once']));
When('I read detect status', async () => run(['detect', 'status']));
When('I run the removed watch command', async () => run(['watch']));
When('I open detect help', async () => run(['detect', '--help']));
Then('the detect exit code is {int}', (expected: number) => assert.equal(world.code, expected));
Then('the detect stdout has exactly {int} line containing {string}', (count: number, text: string) => {
  assert.equal(world.out.length, count); assert.ok(world.out.join('\n').includes(text), world.out.join('\n'));
});
Then('the detect stderr is empty', () => assert.deepEqual(world.err, []));
Then('the detect stderr contains {string}', (text: string) => assert.ok(world.err.join('\n').includes(text)));
