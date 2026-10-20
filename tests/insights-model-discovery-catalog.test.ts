import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyDiscoveryToCatalog, catalogWithDiscovery, enrollDiscoveredModels, loadDiscoveredSnapshots } from '../src/insights/model-discovery-catalog.js';
import { buildCandidatePool } from '../src/insights/letter-top10-candidates.js';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { runModelDiscovery } from '../src/insights/model-discovery-runner.js';
import { FileModelRegistrySnapshotStore } from '../src/insights/model-discovery-file-store.js';
import { parseOpenCodeDiscovery } from '../src/insights/model-discovery-adapters.js';
import { officialFreeListing, parseOfficialFreeIdsFromPage } from '../src/insights/opencode-free-official.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

/** 공식 페이지 형태 그대로(transport stub은 이 문자열만 반환, 내용 조작 없음). */
const GO_PAGE = `<table>
<tr><td>MiniMax M3.1 Flash</td><td>minimax-m3.1-flash-free</td></tr>
<tr><td>Beam</td><td>beam-free</td></tr>
<tr><td>MiniMax M3.1 Flash</td><td>Free</td><td>Free</td></tr>
<tr><td>Beam</td><td>Free</td><td>Free</td></tr>
</table>`;
const CLI_OUT = 'opencode-go/minimax-m3.1-flash-free\nopencode-go/ghost-free\n';
const DATE = '2026-10-20';
const listing = () => officialFreeListing({ goPage: parseOfficialFreeIdsFromPage(GO_PAGE) ?? [] });
const cliRows = () => parseOpenCodeDiscovery(CLI_OUT, DATE);
const CATALOG: readonly PlanCatalogEntry[] = [{ planId: 'base', planName: 'base', models: [] }];
const OFF = {}, ON = { autoEnroll: true };
const LISTS = { allowOlder: [], excludePatterns: [], ban: { common: [], orchestrator: [], worker: [] } };

test('1. official cross-ref enrolls listed+observed with official metadata', () => {
  const { entries, rejected } = enrollDiscoveredModels(cliRows(), listing());
  const models = entries.flatMap(e => e.models);
  const mm = models.find(x => x.modelId === 'minimax-m3-1-flash-free');
  assert.ok(mm?.verified && mm.sourceUrl.includes('opencode.ai') && mm.checkedOn === '2026-10-20');
  assert.ok(entries.some(e => e.planId === 'opencode-go-free' && e.models.some(x => x.modelId === 'minimax-m3-1-flash-free')), 'plan follows CLI+official agreement (go, not zen)');
  assert.ok(!entries.some(e => e.planId === 'opencode-zen-free' && e.models.some(x => x.modelId === 'minimax-m3-1-flash-free')));
  assert.ok(!models.some(x => x.modelId.includes('ghost')), 'unlisted stays out');
  assert.ok(rejected.some(r => r.modelId.includes('ghost') && r.reasons.includes('not-officially-listed')));
});

test('2. autoEnroll off leaves catalog identical; storage keeps verified:false', async () => {
  assert.equal(applyDiscoveryToCatalog(CATALOG, cliRows(), OFF), CATALOG);
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-disc-store-')); try {
    const store = new FileModelRegistrySnapshotStore(dir);
    await runModelDiscovery({ config: { enabled: true, providers: ['opencode'] }, store,
      runCommand: async () => CLI_OUT, checkedOn: DATE });
    const stored = JSON.parse(readFileSync(join(dir, readdirSync(dir)[0]!), 'utf8'));
    assert.equal(stored.models.length, 2, 'both CLI rows stored (no silent drop)');
    assert.ok(stored.models.every((m: { verified: boolean }) => m.verified === false), 'store never promotes');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('3. enrolled models reach the pool; ban/exclude downstream still filters', () => {
  const merged = applyDiscoveryToCatalog(CATALOG, cliRows(), { autoEnroll: true, listing: listing() });
  const rec = { modelId: 'minimax-m3-1-flash-free', metric: 'x', value: 1 };
  assert.ok(buildCandidatePool([rec], merged, [], LISTS).accessibleRecords.some(r => r.modelId === rec.modelId));
  const shut = buildCandidatePool([rec], merged, [], { ...LISTS, excludePatterns: ['minimax'] });
  assert.ok(!shut.accessibleRecords.some(r => r.modelId === rec.modelId), 'exclude still filters');
});

test('4. snapshot failures are last-good (no throw, no fabrication)', () => {
  assert.deepEqual(loadDiscoveredSnapshots(join(tmpdir(), 'yoroi-no-such-dir-xyz')), []);
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-disc-')); try {
    writeFileSync(join(dir, 'a.json'), '{broken');
    writeFileSync(join(dir, 'b.json'), JSON.stringify({ generation: 1, observedAt: `${DATE}T00:00:00Z`, providerId: 'opencode', models: cliRows() }));
    const loaded = loadDiscoveredSnapshots(dir);
    assert.ok(loaded.some(x => x.modelId.includes('minimax')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('5. real chain collect->registry->catalog->candidate->letter enrolls listed model', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-disc-e2e-')); try {
    const store = new FileModelRegistrySnapshotStore(dir);
    const res = await runModelDiscovery({ config: { enabled: true, providers: ['opencode'] }, store,
      runCommand: async () => CLI_OUT, checkedOn: DATE });
    assert.equal(res.summary.providers, 1);
    assert.equal(res.summary.errors, 0);
    const merged = catalogWithDiscovery([], { autoEnroll: true, baseDir: dir, listing: listing() });
    const goPlan = merged.find(p => p.planId === 'opencode-go-free');
    assert.equal(goPlan?.planName, 'OpenCode Go Free');
    assert.equal(goPlan?.tier, 'free');
    const pool = buildCandidatePool([{ modelId: 'minimax-m3-1-flash-free', metric: 'artificial_analysis_intelligence_index', value: 90 }],
      merged, [], LISTS);
    assert.ok(pool.accessibleRecords.some(r => r.modelId === 'minimax-m3-1-flash-free'), 'enrolled id is pool-accessible');
    const letter = computeRoleTop10([{ modelId: 'minimax-m3-1-flash-free', metric: 'artificial_analysis_intelligence_index', value: 90 }],
      { letterModelLists: LISTS, catalog: merged });
    assert.ok(JSON.stringify(letter).includes('minimax'), 'letter carries the enrolled model');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
