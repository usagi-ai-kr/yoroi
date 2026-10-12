import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { After, Before, Given, Then, When } from '@cucumber/cucumber';
import { compose } from '../../src/composition-root.js';
import { createSnapshot } from '../../src/domain/usage.js';
import { openUsageHistory } from '../../src/infra/sqlite/usage-history-store.js';

const world = { dir: '', out: [] as string[], err: [] as string[], code: -1 };

Before(() => {
  world.dir = mkdtempSync(join(tmpdir(), 'yoroi-trend-bdd-'));
  Object.assign(world, { out: [], err: [], code: -1 });
});

After(() => {
  rmSync(world.dir, { recursive: true, force: true });
});

async function run(argv: string[]): Promise<void> {
  world.code = await compose({
    configEnv: { YOROI_DATA_DIR: world.dir, HOME: world.dir },
    dataDir: world.dir,
    output: { stdout: line => world.out.push(line), stderr: line => world.err.push(line) },
    subscribeSignals: () => () => {},
  }).run(argv);
}

Given('no trend observation history DB exists', () => {});

Given('trend observation history with sample data exists', () => {
  const history = openUsageHistory({ YOROI_DATA_DIR: world.dir });
  try {
    const now = Date.now();
    const t = (offsetHours: number) => new Date(now + offsetHours * 3600 * 1000).toISOString();
    history.record(
      createSnapshot('claude', t(-2), [{ id: '5h', unit: 'percent', percent: 10 }]),
      { scope: 's', contractVersion: '1' },
    );
    history.record(
      createSnapshot('claude', t(0), [{ id: '5h', unit: 'percent', percent: 20 }]),
      { scope: 's', contractVersion: '1' },
    );
  } finally {
    history.close();
  }
});

When('I run trend', () => run(['trend']));
When('I run trend --help', () => run(['trend', '--help']));
When('I run trend --since 90d', () => run(['trend', '--since', '90d']));

Then('the trend exit code is {int}', (expected: number) => assert.equal(world.code, expected));
Then('the trend stdout contains {string}', (text: string) => assert.ok(world.out.join('\n').includes(text)));
Then('the trend stderr is empty', () => assert.deepEqual(world.err, []));
Then('the trend stderr contains {string}', (text: string) => assert.ok(world.err.join('\n').includes(text)));
