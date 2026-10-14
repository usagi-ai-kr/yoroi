import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCandidatePool, buildRoleVariants } from '../src/insights/letter-top10-candidates.js';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import type { Top10Options, Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const INTEL = 'artificial_analysis_intelligence_index';
const catalogFor = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'free-test', planName: 'Free Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-13', verified: true })) }];

const ZONE = ['fixture-zone-a', 'fixture-zone-b'];
const AA_ROWS: readonly Top10RecordInput[] = [
  { modelId: 'fixture-zone-a', value: 90, metric: INTEL, priceInput: 0.5, priceOutput: 0.5 },
  { modelId: 'fixture-zone-b', value: 80, metric: INTEL, priceInput: 0.5, priceOutput: 0.5 }];
const OR_ROWS: readonly Top10RecordInput[] = [{ modelId: 'or-bunny', value: 5000, metric: 'total_tokens' },
  { modelId: 'oc-dual', value: 100, metric: 'total_tokens' }];
const OC_ROWS: readonly Top10RecordInput[] = [{ modelId: 'oc-heavy', value: 9_000_000_000, metric: 'opencode_data_tokens' },
  { modelId: 'oc-lite', value: 1_000_000, metric: 'opencode_data_tokens' },
  { modelId: 'oc-dual', value: 1_000_000_000, metric: 'opencode_data_tokens' }];
const catalog = catalogFor([...ZONE, 'or-bunny', 'oc-heavy', 'oc-lite', 'oc-dual']);
const opts: Top10Options = { catalog, openrouterRecords: OR_ROWS, opencodeDataRecords: OC_ROWS };

test('AA-unmeasured models stay in the pool when OpenRouter or OpenCode evidence rows exist', () => {
  const pool = buildCandidatePool(AA_ROWS, catalog, [...OR_ROWS, ...OC_ROWS]);
  const accessible = new Set(pool.accessibleRecords.map(r => r.modelId));
  for (const id of ['or-bunny', 'oc-heavy', 'oc-lite']) assert.ok(accessible.has(id), id);
});

test('evidence-backed AA-unmeasured models fill Top10 after zone rows, ordered by usage evidence', () => {
  const entries = computeRoleTop10(AA_ROWS, opts).orchestrator.entries;
  // oc-dual은 OR tokens(100)을 우선 사용하므로 oc-heavy(OpenCode 9e9)보다 usage가 낮다 — OR 우선 근거.
  assert.deepEqual(entries.map(e => e.modelId), ['fixture-zone-a', 'fixture-zone-b', 'oc-heavy', 'oc-lite', 'or-bunny', 'oc-dual']);
  for (const e of entries.slice(2)) { assert.equal(e.indexMissing, true); assert.equal(e.belowZone, true); }
});

test('opencode-only evidence feeds the usage component and renders in the letter', () => {
  const variants = buildRoleVariants([...AA_ROWS, ...OC_ROWS], INTEL, { catalog, opencodeDataRecords: OC_ROWS });
  const heavy = variants.find(v => v.modelId === 'oc-heavy');
  assert.equal(heavy?.opencodeTokens, 9_000_000_000);
  assert.equal(heavy?.indexMissing, true);
  const letter = renderTop10FromRecords({ publicationDate: '2026-10-13', records: [...AA_ROWS, ...OC_ROWS], ...opts });
  assert.ok(letter.includes('oc-heavy'), 'AA 미측정이지만 참고 자료가 있으면 레터에도 나온다');
});

test('a model both AA-recorded and evidence-backed keeps its AA index without placeholder duplication', () => {
  const orRow: Top10RecordInput = { modelId: 'fixture-zone-a', metric: 'total_tokens', value: 42 };
  const variants = buildRoleVariants([...AA_ROWS, orRow], INTEL, { catalog, openrouterRecords: [orRow] });
  assert.equal(variants.filter(v => v.modelId === 'fixture-zone-a').length, 1, '지수 보유 모델은 placeholder 없이 한 변형');
  assert.equal(variants.find(v => v.modelId === 'fixture-zone-a')?.openrouterTokens, 42);
});