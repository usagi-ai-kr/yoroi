import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

/** 1.0.3: 워커 effort 라벨이 실제 사용한 AA 값의 effort와 일치하는지 좁게 검증한다. */
const INTEL = 'artificial_analysis_intelligence_index';
const catalogOf = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'w-test', planName: 'W Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-16', verified: true })) }];
const aa = (modelId: string, value: number): Top10RecordInput => ({ modelId, metric: INTEL, value });
const cog = (modelId: string, value: number): Top10RecordInput => ({ modelId, metric: 'cognition_correct', value });

test('p103: AA에 있는 chosen effort는 라벨·지수 그대로 유지된다', () => {
  const lists = computeRoleTop10([aa('gpt-6-1-sol-medium', 50), aa('gpt-6-1-sol-max', 90), aa('other', 100)],
    { catalog: catalogOf(['gpt-6-1-sol', 'other']), cognitionRecords: [cog('gpt-6-1-sol-medium', 0.9), cog('other', 0.5)] });
  const sol = lists.worker.entries.find(e => e.modelId === 'gpt-6-1-sol');
  assert.equal(sol?.repEffort, 'medium');
  assert.equal(sol?.indexText, '50.0');
});

test('p103: AA에 없는 chosen effort는 실제 사용한 AA 값(max)의 effort로 정합된다', () => {
  const lists = computeRoleTop10([aa('deepseek-v4-1-flash-max', 39.5), aa('other', 50)],
    { catalog: catalogOf(['deepseek-v4-1-flash', 'other']), cognitionRecords: [cog('deepseek-v4-1-flash-high', 0.9), cog('other', 0.5)] });
  const d = lists.worker.entries.find(e => e.modelId === 'deepseek-v4-1-flash');
  assert.equal(d?.repEffort, 'max');
  assert.equal(d?.indexText, '39.5');
});

test('p103: AA 근거가 전무하면 기존 워커 정책(intel 하한) 그대로 — 목록에 나타나지 않는다', () => {
  const lists = computeRoleTop10([aa('other', 50)],
    { catalog: catalogOf(['deepseek-v4-1-flash', 'other']), cognitionRecords: [cog('deepseek-v4-1-flash-high', 0.9), cog('other', 0.5)] });
  assert.ok(!lists.worker.entries.some(e => e.modelId === 'deepseek-v4-1-flash'));
});
