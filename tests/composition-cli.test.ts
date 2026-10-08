import assert from 'node:assert/strict';
import test from 'node:test';
import { compose } from '../src/composition-root.js';
import { createSnapshot, providers } from '../src/domain/usage.js';
import type { SourceFactories } from '../src/composition/sources.js';

test('composition runs all five fake adapters through CLI once with runtime configuration', async () => {
  const stdout: string[] = [], stderr: string[] = [];
  const factories: SourceFactories = Object.fromEntries(providers.map(provider => [provider,
    () => ({ provider, read: async () => createSnapshot(provider, '2026-10-07T00:00:00Z', []) })]));
  const cli = compose({ configEnv: { YOROI_PROVIDERS: providers.join(','),
    YOROI_OLLAMA_PRO_SIGNING_KEY_PATH: '/fake/key', YOROI_OPENCODE_GO_API_KEY: 'fake-key' }, factories,
    output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) } });
  assert.equal(await cli.run(['once']), 0);
  for (const provider of providers) assert.ok(stdout.some(line => line.startsWith(provider + ':')));
  assert.deepEqual(stderr, []);
});
test('composition validates credentials before sources start; help remains available', async () => {
  const stderr: string[] = [];
  const cli = compose({ configEnv: { YOROI_PROVIDERS: 'ollama-pro' }, factories: {
    'ollama-pro': () => { assert.fail('must validate before adapter creation'); },
  }, output: { stdout: () => {}, stderr: line => stderr.push(line) } });
  assert.equal(await cli.run(['once']), 2);
  assert.match(stderr[0]!, /Missing credential/);
  assert.equal(await cli.run(['--help']), 0);
});
