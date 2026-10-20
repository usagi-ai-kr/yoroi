import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInsights } from '../src/composition/insights.js';
import type { ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { buildFreeCatalog, buildOfficialFreeCatalog, collectOpenCodeFreeModels, freeOnlyModelIdsFromCatalog, parseOpenCodeFreeModels } from '../src/insights/opencode-free-models.js';
import { officialFreeListing } from '../src/insights/opencode-free-official.js';
import type { HttpClient } from '../src/infra/http-client.js';

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

test('BLOCK-2: 관측된 모델만 originalId 를 갖고 미관측 공식 모델은 합성하지 않는다', () => {
  const cli = parseOpenCodeFreeModels('opencode/minimax-m3.1-flash-free\nopencode-go/beam-free');
  const listing = officialFreeListing({ zenPage: ['minimax-m3.1-flash-free', 'big-pickle'], goPage: ['beam-free', 'longcat-2.5-preview-free'] });
  const built = buildOfficialFreeCatalog(cli, '2026-10-20', listing);
  const zen = built.plans.find(p => p.planId === 'opencode-zen-free')!.models;
  assert.equal(zen.find(m => m.modelId === 'minimax-m3-1-flash-free')?.originalId, 'opencode/minimax-m3.1-flash-free', '관측된 원본 id 유지');
  assert.equal(zen.find(m => m.modelId === 'big-pickle')?.originalId, undefined, '미관측 모델은 originalId 를 합성하지 않는다');
  const go = built.plans.find(p => p.planId === 'opencode-go-free')!.models;
  assert.equal(go.find(m => m.modelId === 'beam-free')?.originalId, 'opencode-go/beam-free');
  assert.equal(go.find(m => m.modelId === 'longcat-2-5-preview-free')?.originalId, undefined);
});
test('CLI 관측만으로는 free 미검증 플랜(체크 열에 ✓ 없음)', () => {
  const models = parseOpenCodeFreeModels(OUTPUT), catalog = buildFreeCatalog(models, '2026-10-13');
  assert.deepEqual(catalog.map(x => [x.planId, x.tier, x.sourceUrl, x.checkedOn, x.verified]), [
    ['opencode-zen-free-observed', 'free', 'opencode models (CLI)', '2026-10-13', false],
    ['opencode-go-free-observed', 'free', 'opencode models (CLI)', '2026-10-13', false]]);
  assert.ok(catalog[0]!.models.every(m => !m.verified), '미검증 → Free 체크 없음');
  assert.equal(freeOnlyModelIdsFromCatalog(catalog).size, 0, '미검증 free 는 free-only 대상이 아니다');
});

test('공식 목록 기반 free 카탈로그는 검증된 플랜만 만들고 CLI 관측은 보조 근거', () => {
  const models = parseOpenCodeFreeModels(OUTPUT);
  const listing = officialFreeListing({ zenPage: ['big-pickle', 'minimax-m3.1-flash-free'], goPage: ['minimax-m3.1-flash-free'] });
  const built = buildOfficialFreeCatalog(models, '2026-10-13', listing);
  assert.deepEqual(built.plans.map(p => [p.planId, p.verified, p.sourceUrl]), [
    ['opencode-zen-free', true, 'https://opencode.ai/v2/docs/console/models'],
    ['opencode-go-free', true, 'https://opencode.ai/v2/docs/console/go']]);
  assert.ok(built.plans[0]!.models.every(m => m.verified));
  assert.ok(built.observedOnly.includes('step-5'), '공식 목록에 없는 CLI 관측은 미검증으로 분리');
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
  const http: HttpClient = { request: async req => ({ status: 200, headers: {},
    body: req.url.includes('/inference/') ? JSON.stringify({ object: 'list', data: [] }) : '<table></table>' }) };
  const result = await runInsights({ env: {}, dataEnv: { YOROI_DATA_DIR: dir }, clock: () => Date.parse('2026-10-13T12:00:00Z'),
    createPorts: () => [], processRunner, http });
  assert.equal(calls, 1);
  // free 판정은 공식 목록이 권위: CLI 관측(접미사)만으로는 체크 열에 ✓ 가 붙지 않는다.
  assert.deepEqual(result.top10?.freeCatalog?.map(plan => plan.planName), ['OpenCode Zen Free', 'OpenCode Go Free']);
  assert.ok(result.top10?.freeCatalog?.every(plan => plan.verified && plan.models.every(m => m.verified)));
  assert.ok(!(result.top10?.freeCatalog ?? []).flatMap(plan => plan.models).some(m => m.modelId === 'step-5' || m.modelId === 'space-bunny'),
    'CLI 관측만으로 free 체크를 만들지 않는다');
  assert.ok(result.top10?.warnings?.some(w => w.includes('Free 목록 출처')), '출처 상태를 알린다');
  assert.ok(!('freeOnlyModelIds' in result.top10!));
});
