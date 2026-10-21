import assert from 'node:assert/strict';
import test from 'node:test';
import { freeBaseIds, freeMessengerEntries, freeMessengerFor, freeReviewerEntries, freeReviewerFor } from '../src/composition/insights-free-reviewer.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import { renderFreeSectionMarkdown } from '../src/insights/letter-markdown-free.js';
import type { RoleLists } from '../src/insights/letter-top10-unified.js';

/** #194 D: Free 3역할 리뷰어 칸 배선 — verified 공식 Free 카탈로그만, 점수·파레토 전달, 비활성 시 기존 출력. */
const freeModel = (modelId: string, displayName = modelId) => ({ modelId, displayName, sourceUrl: 'https://opencode.ai/v2/docs/console/models',
  checkedOn: '2026-10-20', verified: true });
const FREE_CATALOG: readonly PlanCatalogEntry[] = [
  { planId: 'opencode-go-free', planName: 'OpenCode Go Free', tier: 'free', models: [freeModel('minimax-m3-1-flash-free'), freeModel('glm-5-3-flash-free')] },
  { planId: 'opencode-go-plus', planName: 'OpenCode Go Plus', tier: 'paid', models: [freeModel('paid-model')] }];
const entry = (modelId: string) => ({ modelId, rank: 1, scoreText: '70.0', indexText: '70.0', plans: [] as string[],
  repEffort: 'default', blendedCostText: '-', change: '유지' as const, isPareto: false, both: false });
const lists = (ids: string[]): RoleLists => ({ orchestrator: { entries: ids.map(entry), exits: [] }, worker: { entries: [], exits: [] } });

test('verified 공식 Free 모델만 exact Free ID(-free)로 매칭된다', () => {
  assert.deepEqual([...freeBaseIds(FREE_CATALOG)].sort(), ['glm-5-3-flash', 'minimax-m3-1-flash']);
  const entries = freeReviewerEntries([
    { modelId: 'minimax-m3-1-flash', score: 0.81, isPareto: true },
    { modelId: 'glm-5-3-flash', score: 0.5 },
    { modelId: 'paid-model', score: 0.9 },
    { modelId: 'unknown-model', score: 0.7 },
    { modelId: 'minimax-m3-1-flash' }], FREE_CATALOG);
  assert.deepEqual(entries.map(e => e.modelId), ['minimax-m3-1-flash-free', 'glm-5-3-flash-free'], 'exact Free ID 로 출력');
  assert.deepEqual(entries.map(e => e.score), ['0.81', '0.50']);
  assert.equal(entries[0]!.isPareto, true, '파레토 그대로 전달');
  assert.equal(entries[1]!.isPareto, false);
  assert.ok(entries.every(e => e.passed));
});

test('점수가 없는 후보는 넣지 않는다(근거 없는 점수 금지)', () => {
  assert.deepEqual(freeReviewerEntries([{ modelId: 'minimax-m3-1-flash' }], FREE_CATALOG), []);
});

test('3역할 비활성이면 undefined(기존 2역할 출력 유지)', () => {
  assert.equal(freeReviewerFor(undefined, { freeCatalog: [...FREE_CATALOG] }), undefined);
  assert.equal(freeReviewerFor({ enabled: true } as never, { freeCatalog: [...FREE_CATALOG] }), undefined, 'producer reviewer 없으면 근거 없음');
  const lines = renderFreeSectionMarkdown(lists(['minimax-m3-1-flash']), [{ modelId: 'minimax-m3-1-flash', plans: ['p'] }], 5, undefined, undefined);
  assert.ok(lines.some(l => l.includes('| 오케 | 워커 |')), '2역할 머리 유지');
  assert.ok(!lines.some(l => l.includes('리뷰어')), '리뷰어 열 없음');
});

test('활성 + 주입이면 Free 3역할 표에 리뷰어 점수가 보인다', () => {
  const injected = freeReviewerFor({ enabled: true, reviewerPool: [{ modelId: 'minimax-m3-1-flash', score: 0.81 }] } as never,
    { freeCatalog: [...FREE_CATALOG] })!;
  assert.equal(injected.length, 1);
  assert.equal(injected[0]!.modelId, 'minimax-m3-1-flash-free');
  const lines = renderFreeSectionMarkdown(lists(['minimax-m3-1-flash-free']), [{ modelId: 'minimax-m3-1-flash-free', plans: ['p'] }], 5, undefined, injected);
  assert.ok(lines.some(l => l.includes('| 오케 | 리뷰어 | 워커 |')), '3역할 머리');
  assert.ok(lines.some(l => l.includes('0.81')), '리뷰어 점수 표시');
});

test('freeMessenger도 verified·exact·점수 원칙을 따른다', () => {
  assert.deepEqual(freeMessengerEntries([
    { modelId: 'minimax-m3-1-flash', score: 70 },
    { modelId: 'glm-5-3-flash', score: 60.5, isPareto: true },
    { modelId: 'paid-model', score: 90 },
    { modelId: 'unknown-model', score: 70 },
    { modelId: 'minimax-m3-1-flash' }], FREE_CATALOG).map(e => [e.modelId, e.score]),
    [['minimax-m3-1-flash-free', '70.00'], ['glm-5-3-flash-free', '60.50']], '미검증·미지·무점수 제외');
});

test('messengerPool 없으면 undefined, 있으면 exact Free ID로 섹션에 보인다', () => {
  assert.equal(freeMessengerFor(undefined, { freeCatalog: [...FREE_CATALOG] }), undefined);
  assert.equal(freeMessengerFor({ enabled: true } as never, { freeCatalog: [...FREE_CATALOG] }), undefined);
  const injected = freeMessengerFor({ enabled: true, messengerPool: [{ modelId: 'minimax-m3-1-flash', score: 70 }] } as never,
    { freeCatalog: [...FREE_CATALOG] })!;
  assert.equal(injected[0]!.modelId, 'minimax-m3-1-flash-free');
  const lines = renderFreeSectionMarkdown(lists(['minimax-m3-1-flash-free']), [{ modelId: 'minimax-m3-1-flash-free', plans: ['p'] }], 5, undefined, undefined, injected);
  assert.ok(lines.some(l => l.includes('| 오케 | 리뷰어 | 워커 | 메신저 |')), '4역할 머리');
  assert.ok(lines.some(l => l.includes('70.00')), '메신저 점수 표시');
});
