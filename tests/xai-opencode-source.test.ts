import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { SourceError } from '../src/app/usage-source.js';
import { loadConfig } from '../src/config/load-config.js';
import { createSources, defaultFactories } from '../src/composition/sources.js';
import type { ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { XaiOpencodeSource } from '../src/infra/xai-opencode-source.js';
import { parseXaiOpencodeStats } from '../src/infra/xai-opencode-stats-parser.js';

const observedAt = '2026-10-14T00:00:00Z';
const fixture = await readFile(new URL('./fixtures/opencode-stats-xai.json', import.meta.url), 'utf8');
const runner = (stdout: string, exitCode = 0): ProcessRunner =>
  ({ run: async (_request: ProcessRequest) => ({ stdout, stderr: '', exitCode }) });
const withModels = (models: unknown[]) => JSON.stringify({ models });
const xaiRow = (patch: Record<string, unknown>) => ({
  model: { providerID: 'xai' }, steps: 1, cost: 0.1, tokens: { input: 1, output: 1, reasoning: 1 }, ...patch,
});

test('xai source runs opencode stats and sums only xai rows', async () => {
  const fake: ProcessRunner = { run: async request => {
    assert.equal(request.executable, 'opencode');
    assert.deepEqual(request.args, ['stats', '--json', '--models', '--cost', '--days', '7']);
    return { stdout: fixture, stderr: '', exitCode: 0 };
  } };
  const snapshot = await new XaiOpencodeSource(fake, 'opencode', 5000, () => observedAt).read();
  assert.equal(snapshot.provider, 'xai');
  assert.equal(snapshot.observedAt, observedAt);
  assert.deepEqual(snapshot.windows, [
    { id: 'xai:7d:tokens', unit: 'tokens', used: 2100 },
    { id: 'xai:7d:steps', unit: 'steps', used: 15 },
    { id: 'xai:7d:cost-estimate', unit: 'usd', used: 0.75 },
  ]);
});

test('xai windows carry only used: no limit, remaining, percent or reset is invented', () => {
  for (const window of parseXaiOpencodeStats(fixture, observedAt).windows) {
    assert.deepEqual(Object.keys(window).sort(), ['id', 'unit', 'used']);
  }
});

test('xai source honors the configured day window', async () => {
  const fake: ProcessRunner = { run: async request => {
    assert.deepEqual(request.args.slice(-2), ['--days', '30']);
    return { stdout: fixture, stderr: '', exitCode: 0 };
  } };
  const snapshot = await new XaiOpencodeSource(fake, 'opencode', 5000, () => observedAt, 30).read();
  assert.equal(snapshot.windows[0]?.id, 'xai:30d:tokens');
});

test('xai source normalizes failures to SourceError codes', async () => {
  await assert.rejects(new XaiOpencodeSource(runner('', 1)).read(), { code: 'exit' });
  await assert.rejects(new XaiOpencodeSource(runner('not json')).read(), { code: 'parse' });
  await assert.rejects(new XaiOpencodeSource(runner('[]')).read(), { code: 'parse' });
  await assert.rejects(new XaiOpencodeSource(runner('{}')).read(), { code: 'parse' });
  assert.throws(() => parseXaiOpencodeStats(fixture, 'not-a-date'), { code: 'parse' });
  const notInstalled: ProcessRunner = { run: async () => { throw new SourceError('not-installed'); } };
  await assert.rejects(new XaiOpencodeSource(notInstalled).read(), { code: 'not-installed' });
  await assert.rejects(new XaiOpencodeSource(runner(fixture), 'opencode', 5000, undefined, 0).read(),
    { code: 'unavailable' });
});

test('no xai row means no usage: used 0 windows without an invented limit', async () => {
  const onlyOther = withModels([xaiRow({ model: { providerID: 'other-provider' } })]);
  for (const stdout of [withModels([]), onlyOther]) {
    const snapshot = await new XaiOpencodeSource(runner(stdout), 'opencode', 5000, () => observedAt).read();
    assert.deepEqual(snapshot.windows.map(w => [w.id, w.used]),
      [['xai:7d:tokens', 0], ['xai:7d:steps', 0], ['xai:7d:cost-estimate', 0]]);
    assert.ok(snapshot.windows.every(w => Object.keys(w).sort().join() === 'id,unit,used'));
  }
});

test('xai is a default provider wired to opencode, with PATH and timeout overrides', async () => {
  const seen: ProcessRequest[] = [];
  const fake: ProcessRunner = { run: async request => { seen.push(request); return { stdout: fixture, stderr: '', exitCode: 0 }; } };
  assert.ok(loadConfig({}).providers.some(p => p.id === 'xai'));
  assert.equal(loadConfig({}).providers.find(p => p.id === 'xai')?.executable, 'opencode');
  const config = loadConfig({ YOROI_PROVIDERS: 'xai', YOROI_XAI_PATH: '/custom/opencode', YOROI_XAI_TIMEOUT_MS: '4000' });
  const [source] = createSources(config, defaultFactories({ runner: fake }));
  assert.equal(source?.provider, 'xai');
  assert.equal((await source!.read()).provider, 'xai');
  assert.deepEqual([seen[0]?.executable, seen[0]?.timeoutMs], ['/custom/opencode', 4000]);
});

test('xai parser rejects malformed xai rows but ignores other providers', () => {
  const bad = [{ steps: -1 }, { steps: 'x' }, { cost: null }, { tokens: { input: 1, output: 1 } }, { tokens: null }];
  for (const patch of bad) {
    assert.throws(() => parseXaiOpencodeStats(withModels([xaiRow(patch)]), observedAt), { code: 'parse' });
  }
  const mixed = withModels([xaiRow({}), { model: { providerID: 'other-provider' }, steps: 'ignored' }]);
  assert.equal(parseXaiOpencodeStats(mixed, observedAt).windows[1]?.used, 1);
});
