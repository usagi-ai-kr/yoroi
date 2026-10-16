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

test('AA-unmeasured evidence models stay orchestrator candidates; linear value applies; usage excluded (R)', () => {
  const entries = computeRoleTop10(AA_ROWS, opts).orchestrator.entries;
  // R 1.2.1 오케 75/0/10/15: zone-a 성능 75 + 가성비 15 = 90.0. 사용량은 오케 점수 미반영이라
  // AA 미측정 근거 모델은 전 차원 0으로 후보만 유지된다(탈락 아님, 동점은 모델명).
  assert.deepEqual(entries.map(e => [e.modelId, e.rawScore?.toFixed(1), e.belowZone]), [['fixture-zone-a', '90.0', undefined], ['fixture-zone-b', '0.0', true],
    ['oc-dual', '0.0', true], ['oc-heavy', '0.0', true], ['oc-lite', '0.0', true], ['or-bunny', '0.0', true]]);
  assert.deepEqual(entries.filter(e => e.indexMissing).map(e => e.modelId), ['oc-dual', 'oc-heavy', 'oc-lite', 'or-bunny']);
  const dual = entries.find(e => e.modelId === 'oc-dual')?.scoreComponents;
  assert.deepEqual([dual?.cost, dual?.dimensionSources?.price], [0, undefined]);
  assert.ok(Math.abs((dual?.usage ?? 0) - 0.759) < 0.001 && dual?.dimensionSources?.usage === 'opencode', 'OCD 사용량이 표준화되어 반영된다(p70)');
});

test('worker: intel is required; opencode-only evidence without intel cannot enter, OR and OCD share one dimension', () => {
  const cognitionRecords = ['oc-heavy-high', 'oc-dual-high'].map(modelId => ({ modelId, metric: 'cognition_correct', value: 0.9 }));
  const w = computeRoleTop10(AA_ROWS, { ...opts, cognitionRecords }).worker.entries, at = (id: string) => w.find(e => e.modelId === id)?.scoreComponents;
  // p85: 사용량 근거만으로는 워커에 진입하지 못한다(성능 intel 없음 → 제외). Cog correct가 있어도 intel이 없으면 마찬가지다.
  assert.ok(!w.some(e => e.modelId === 'oc-heavy'), 'intel 없으면 사용량·Cog만으로 워커에 진입하지 않는다');
  assert.ok(!w.some(e => e.modelId === 'oc-dual'), 'intel 없으면 OR+OCD가 있어도 제외된다');
  const letter = renderTop10FromRecords({ publicationDate: '2026-10-13', records: [...AA_ROWS, ...OC_ROWS], ...opts });
  assert.ok(letter.includes('oc-heavy'), 'AA 미측정이지만 참고 자료가 있으면 레터 Free 표에는 나온다');
  // OR·OCD는 하나의 사용량 차원을 공유한다(이중 가산 없음): intel이 있는 모델로 확인한다.
  const shared = computeRoleTop10([...AA_ROWS,
    { modelId: 'oc-dual', value: 50, metric: INTEL },
    { modelId: 'oc-dual', value: 100, metric: 'total_tokens' },
    { modelId: 'oc-dual', value: 1_000_000_000, metric: 'opencode_data_tokens' }], opts).worker.entries
    .find(e => e.modelId === 'oc-dual')?.scoreComponents;
  assert.ok(shared !== undefined && Math.abs(shared.usage - Math.max(shared.sources?.['usage:openrouter'] ?? 0, shared.sources?.['usage:opencode'] ?? 0)) < 1e-9);
});

test('a model both AA-recorded and evidence-backed keeps its AA index without placeholder duplication', () => {
  const orRow: Top10RecordInput = { modelId: 'fixture-zone-a', metric: 'total_tokens', value: 42 };
  const variants = buildRoleVariants([...AA_ROWS, orRow], INTEL, { catalog, openrouterRecords: [orRow] });
  assert.equal(variants.filter(v => v.modelId === 'fixture-zone-a').length, 1, '지수 보유 모델은 placeholder 없이 한 변형');
  assert.equal(variants.find(v => v.modelId === 'fixture-zone-a')?.openrouterTokens, 42);
});