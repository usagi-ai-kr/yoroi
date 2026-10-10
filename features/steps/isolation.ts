import { Before, After } from '@cucumber/cucumber';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let scenarioDir: string | undefined;
let previous: string | undefined;
Before(() => {
  previous = process.env.YOROI_DATA_DIR;
  scenarioDir = mkdtempSync(join(tmpdir(), 'yoroi-bdd-data-'));
  process.env.YOROI_DATA_DIR = join(scenarioDir, 'data');
});
After(() => {
  if (scenarioDir) rmSync(scenarioDir, { recursive: true, force: true });
  if (previous === undefined) delete process.env.YOROI_DATA_DIR;
  else process.env.YOROI_DATA_DIR = previous;
  scenarioDir = undefined;
});
