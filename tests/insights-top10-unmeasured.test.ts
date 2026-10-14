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

test('AA-unmeasured evidence models stay orchestrator candidates; p70 orchestrator usage contributes and missing value-for-money scores 0', () => {
  const entries = computeRoleTop10(AA_ROWS, opts).orchestrator.entries;
  // p70 오케 70/5/10/15: zone-a 성능 70+가성비 15(90²/0.51 > 80²/0.51)=85.0, zone-b 0. AA 미측정은 I·P 결측 → 가성비 0(.99 없음),
  // 사용량(OR·OCD 표준화 × 5%)만 기여 → 최고 근거 모델 5.0, 동점은 모델명.
  assert.deepEqual(entries.map(e => [e.modelId, e.scoreText, e.belowZone]), [['fixture-zone-a', '85.0', undefined], ['oc-heavy', '5.0', true],
    ['or-bunny', '5.0', true], ['oc-dual', '3.8', true], ['fixture-zone-b', '0.0', true], ['oc-lite', '0.0', true]]);
  assert.deepEqual(entries.filter(e => e.indexMissing).map(e => e.modelId), ['oc-heavy', 'or-bunny', 'oc-dual', 'oc-lite']);
  const dual = entries.find(e => e.modelId === 'oc-dual')?.scoreComponents;
  assert.deepEqual([dual?.cost, dual?.dimensionSources?.price], [0, undefined]);
  assert.ok(Math.abs((dual?.usage ?? 0) - 0.759) < 0.001 && dual?.dimensionSources?.usage === 'opencode', 'OCD 사용량이 표준화되어 반영된다(p70)');
});

test('worker: opencode-only evidence is a standardized usage source, OR and OCD share one dimension, and the letter renders it', () => {
  const cognitionRecords = ['oc-heavy-high', 'oc-dual-high'].map(modelId => ({ modelId, metric: 'cognition_correct', value: 0.9 })); // 워커 하한 통과용
  const w = computeRoleTop10(AA_ROWS, { ...opts, cognitionRecords }).worker.entries, at = (id: string) => w.find(e => e.modelId === id)?.scoreComponents;
  assert.deepEqual([at('oc-heavy')?.sources?.['usage:opencode'], at('oc-heavy')?.dimensionSources?.usage], [1, 'opencode']);
  // oc-dual: OR 0(100 < 5000), OCD (9-6)/(log10 9e9 - 6) ≈ .759 → 사용량은 둘 중 높은 값 하나(이중 가산 없음).
  assert.ok(Math.abs((at('oc-dual')?.usage ?? 0) - 3 / (Math.log10(9e9) - 6)) < 1e-9 && at('oc-dual')?.sources?.['usage:openrouter'] === 0);
  assert.ok(!computeRoleTop10(AA_ROWS, opts).worker.entries.some(e => e.modelId === 'oc-heavy'), '성능 결측(<.70)이면 사용량만으로 워커에 진입하지 않는다');
  const letter = renderTop10FromRecords({ publicationDate: '2026-10-13', records: [...AA_ROWS, ...OC_ROWS], ...opts });
  assert.ok(letter.includes('oc-heavy'), 'AA 미측정이지만 참고 자료가 있으면 레터에도 나온다');
});

test('a model both AA-recorded and evidence-backed keeps its AA index without placeholder duplication', () => {
  const orRow: Top10RecordInput = { modelId: 'fixture-zone-a', metric: 'total_tokens', value: 42 };
  const variants = buildRoleVariants([...AA_ROWS, orRow], INTEL, { catalog, openrouterRecords: [orRow] });
  assert.equal(variants.filter(v => v.modelId === 'fixture-zone-a').length, 1, '지수 보유 모델은 placeholder 없이 한 변형');
  assert.equal(variants.find(v => v.modelId === 'fixture-zone-a')?.openrouterTokens, 42);
});