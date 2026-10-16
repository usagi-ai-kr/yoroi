import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_LETTER_MODEL_LISTS, banSetFor, loadLetterModelLists, type LetterModelLists }
  from '../src/insights/letter-model-lists.js';
import { olderGenerationModelIds } from '../src/insights/letter-top10-filter.js';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

/** 계약(docs/insights/letter-model-lists-1.1.md) 기준 테스트. 구현 전에는 실패가 정상. */
const INTEL = 'artificial_analysis_intelligence_index';
const catalogFor = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 't', planName: 'T',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-16', verified: true })) }];
const row = (modelId: string, value: number, extra: Partial<Top10RecordInput> = {}): Top10RecordInput =>
  ({ modelId, metric: INTEL, value, ...extra });
const listsWith = (over: Partial<LetterModelLists>): LetterModelLists => ({ ...DEFAULT_LETTER_MODEL_LISTS, ...over });

test('loadLetterModelLists: 없으면 기본값·누락 키는 기본값·파싱 실패는 throw', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lml-'));
  assert.deepEqual(loadLetterModelLists(join(dir, 'missing.json')), DEFAULT_LETTER_MODEL_LISTS);
  const file = join(dir, 'lists.json');
  writeFileSync(file, JSON.stringify({ allowOlder: ['x-1'] }));
  const merged = loadLetterModelLists(file);
  assert.deepEqual(merged.allowOlder, ['x-1']);
  assert.deepEqual(merged.excludePatterns, DEFAULT_LETTER_MODEL_LISTS.excludePatterns);
  assert.deepEqual(merged.ban, DEFAULT_LETTER_MODEL_LISTS.ban);
  writeFileSync(file, '{oops');
  assert.throws(() => loadLetterModelLists(file));
});

test('banSetFor: 정규화된 공통 ∪ 역할만 돌려준다', () => {
  const lists = listsWith({ ban: { common: ['LongCat-2.5'], orchestrator: ['grok-4-6'], worker: ['step-5'] } });
  assert.deepEqual([...banSetFor(lists, 'orchestrator')].sort(), ['grok-4-6', 'longcat-2-5']);
  assert.deepEqual([...banSetFor(lists, 'worker')].sort(), ['longcat-2-5', 'step-5']);
});

test('allowOlder: grok-4-6·gpt-6-sol 유지, 미등재 하위버전 배제, 목록 제거 시 배제', () => {
  const ids = ['grok-4-7', 'grok-4-6', 'grok-4-5', 'gpt-6-1-sol', 'gpt-6-sol'];
  const def = olderGenerationModelIds(ids);
  assert.deepEqual([...def].sort(), ['grok-4-5']);
  const none = olderGenerationModelIds(ids, []);
  assert.ok(none.has('grok-4-6') && none.has('gpt-6-sol') && !none.has('grok-4-7') && !none.has('gpt-6-1-sol'));
  const onlyGrok = olderGenerationModelIds(ids, ['grok-4-6']);
  assert.ok(!onlyGrok.has('grok-4-6') && onlyGrok.has('gpt-6-sol'));
});

test('successorOf 규칙도 allowOlder가 차단한다(세대 비교로는 배제되지 않는 쌍)', () => {
  const ids = ['kimi-k4', 'kimi-k3'];
  const records = [row('kimi-k4', 70, { successorOf: 'kimi-k3' }), row('kimi-k3', 60)];
  const kept = computeRoleTop10(records, { catalog: catalogFor(ids), letterModelLists: listsWith({ allowOlder: ['kimi-k3'] }) });
  const dropped = computeRoleTop10(records, { catalog: catalogFor(ids), letterModelLists: listsWith({}) });
  assert.ok(kept.orchestrator.entries.some(e => e.modelId === 'kimi-k3'), '목록에 있으면 후속 규칙을 건너뛴다');
  assert.ok(!dropped.orchestrator.entries.some(e => e.modelId === 'kimi-k3'), '목록에 없으면 후속 규칙으로 배제');
});

test('빈 ban + 기본 allowOlder면 현재 Top10과 완전히 동일하다', () => {
  const ids = ['alpha', 'beta', 'gamma', 'delta'];
  const records = [row('alpha', 90), row('beta', 80), row('gamma', 70), row('delta', 60)];
  const base = computeRoleTop10(records, { catalog: catalogFor(ids) });
  assert.deepEqual(computeRoleTop10(records, { catalog: catalogFor(ids), letterModelLists: DEFAULT_LETTER_MODEL_LISTS }), base);
});

test('ban: 점수·모집단 불변, Top10 선발에서만 제외, 반대 역할 무영향·▽ 재진입 없음', () => {
  const ids = ['alpha', 'beta', 'gamma', 'delta'];
  const records = [row('alpha', 90), row('beta', 80), row('gamma', 70), row('delta', 60)];
  const base = computeRoleTop10(records, { catalog: catalogFor(ids) });
  const banned = computeRoleTop10(records, { catalog: catalogFor(ids),
    letterModelLists: listsWith({ ban: { common: [], orchestrator: ['alpha'], worker: [] } }) });
  const scoreText = (lists: typeof base, id: string) => lists.orchestrator.entries.find(e => e.modelId === id)?.scoreText;
  assert.ok(scoreText(base, 'beta'));
  assert.equal(scoreText(banned, 'beta'), scoreText(base, 'beta'), '남은 모델의 표시 점수(모집단) 불변');
  assert.ok(!banned.orchestrator.entries.some(e => e.modelId === 'alpha'), '오케 Top10에서 제외(▽ 재진입 없음)');
  assert.ok(banned.worker.entries.some(e => e.modelId === 'alpha'), '반대 역할(워커)에는 영향 없음');
});
