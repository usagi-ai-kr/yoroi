import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { compose } from '../src/composition-root.js';
import { parseArgs } from '../src/ui/cli/args.js';

test('CLI version matches package.json without credentials, source creation or external calls', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'yoroi-version-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(metadata.version, '0.8.4');
  assert.match(metadata.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  const stdout: string[] = [], stderr: string[] = [];
  const cli = compose({ dataDir, configEnv: { YOROI_PROVIDERS: 'opencode-go' },
    output: { stdout: value => stdout.push(value), stderr: value => stderr.push(value) },
    factories: { 'opencode-go': () => { assert.fail('version must bypass provider construction'); } } });
  for (const flag of ['--version', '-v']) assert.equal(await cli.run([flag]), 0);
  assert.deepEqual(stdout, [`yoroi ${metadata.version}`, `yoroi ${metadata.version}`]);
  assert.deepEqual(stderr, []);
  assert.equal(parseArgs(['--version', 'once']).kind, 'error');
});
