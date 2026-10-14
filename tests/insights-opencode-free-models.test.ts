import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInsights } from '../src/composition/insights.js';
import type { ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { buildFreeCatalog, collectOpenCodeFreeModels, freeOnlyModelIdsFromCatalog, parseOpenCodeFreeModels } from '../src/insights/opencode-free-models.js';

const OUTPUT = `opencode/exo-free
opencode/ling-3.0-flash-fin-free
opencode/ling-3.1-flash-free
opencode/longcat-2.5-preview-free
opencode/mimo-v2.6-flash-free
opencode/muse-spark-1.3-contributor-free
opencode/nemotron-3-ultra-free
opencode/nemotron-3.5-lightning-free
opencode/space-bunny-free
opencode/step-5-preview-free
opencode-go/longcat-2.5-preview-free
opencode-go/step-5-preview-free`;

test('parses the 12 CLI Free rows and maps each AA slug while preserving provider IDs', () => {
  const models = parseOpenCodeFreeModels(`${OUTPUT}\nopencode/big-pickle\nollama-cloud/step-5-free`);
  assert.equal(models.length, 12);
  assert.deepEqual(models.map(x => x.modelId), ['exo', 'ling-3-0-flash-fin', 'ling-3-1-flash', 'longcat-2-5', 'mimo-v2-6-flash',
    'muse-spark-1-3', 'nemotron-3-ultra', 'nemotron-3-5-lightning', 'space-bunny', 'step-5', 'longcat-2-5', 'step-5']);
  assert.equal(models[5]!.originalId, 'opencode/muse-spark-1.3-contributor-free');
  assert.equal(models[10]!.provider, 'opencode-go');
});

test('builds verified Zen/Go catalogs and derives only-free IDs against paid plans', () => {
  const models = parseOpenCodeFreeModels(OUTPUT), catalog = buildFreeCatalog(models, '2026-10-13');
  assert.deepEqual(catalog.map(x => [x.planName, x.tier, x.sourceUrl, x.checkedOn]), [
    ['OpenCode Zen Free', 'free', 'opencode models (CLI)', '2026-10-13'], ['OpenCode Go Free', 'free', 'opencode models (CLI)', '2026-10-13']]);
  assert.equal(catalog[0]!.models[0]!.verified, true);
  const only = freeOnlyModelIdsFromCatalog(catalog);
  assert.ok(only.has('step-5') && only.has('ling-3-1-flash'));
  assert.ok(!only.has('space-bunny') && !only.has('mimo-v2-6-flash') && !only.has('muse-spark-1-3'),
    'models already on paid catalog plans remain paid-list candidates');
});

test('injects the runner with a 30-second timeout and returns no cached data on failure with one diagnostic', async () => {
  let request: ProcessRequest | undefined;
  const runner: ProcessRunner = { run: async r => { request = r; return { stdout: OUTPUT, stderr: '', exitCode: 0 }; } };
  assert.equal((await collectOpenCodeFreeModels(runner)).length, 12);
  assert.deepEqual([request!.executable, request!.args, request!.timeoutMs], ['opencode', ['models'], 30_000]);
  const diagnostics: string[] = [], failed: ProcessRunner = { run: async () => { throw new Error('not installed'); } };
  assert.deepEqual(await collectOpenCodeFreeModels(failed, { diagnostic: line => diagnostics.push(line) }), []);
  const nonzero: ProcessRunner = { run: async () => ({ stdout: OUTPUT, stderr: 'ignored', exitCode: 2 }) };
  assert.deepEqual(await collectOpenCodeFreeModels(nonzero, { diagnostic: line => diagnostics.push(line) }), []);
  assert.equal(diagnostics.length, 2);
});

test('CLI composition passes the full live Free catalog through Top10 data', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-free-live-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  let calls = 0;
  const processRunner: ProcessRunner = { run: async () => { calls++; return { stdout: 'opencode/step-5-preview-free\nopencode-go/space-bunny-free', stderr: '', exitCode: 0 }; } };
  const result = await runInsights({ env: {}, dataEnv: { YOROI_DATA_DIR: dir }, clock: () => Date.parse('2026-10-13T12:00:00Z'),
    createPorts: () => [], processRunner });
  assert.equal(calls, 1);
  assert.deepEqual(result.top10?.freeCatalog?.map(plan => plan.planName), ['OpenCode Zen Free', 'OpenCode Go Free']);
  assert.deepEqual(result.top10?.freeCatalog?.flatMap(plan => plan.models.map(model => model.modelId)), ['step-5', 'space-bunny']);
  assert.ok(!('freeOnlyModelIds' in result.top10!));
});
