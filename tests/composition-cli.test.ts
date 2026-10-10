import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compose } from '../src/composition-root.js';
import { createSnapshot, providers } from '../src/domain/usage.js';
import type { SourceFactories } from '../src/composition/sources.js';

test('composition runs all five fake adapters by default without YOROI_PROVIDERS set', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'yoroi-composition-cli-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const stdout: string[] = [], stderr: string[] = [];
  const factories: SourceFactories = Object.fromEntries(providers.map(provider => [provider,
    () => ({ provider, read: async () => createSnapshot(provider, '2026-10-07T00:00:00Z', []) })]));
  const cli = compose({ dataDir, configEnv: {}, factories,
    output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) } });
  assert.equal(await cli.run(['once']), 0);
  for (const provider of providers) assert.ok(stdout.some(line => line.startsWith(provider + ':')));
  assert.deepEqual(stderr, []);
});
test('composition rejects invalid provider selection with exit code 2 and preserves help', async () => {
  const stderr: string[] = [];
  const cli = compose({ configEnv: { YOROI_PROVIDERS: 'invalid' },
    output: { stdout: () => {}, stderr: line => stderr.push(line) } });
  assert.equal(await cli.run(['once']), 2);
  assert.match(stderr[0]!, /Invalid provider selection/);
  assert.equal(await cli.run(['--help']), 0);
});
