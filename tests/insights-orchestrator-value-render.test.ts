import assert from 'node:assert/strict';
import test from 'node:test';
import { dimensionsLabel, dimensionsText, LEGEND_LINES } from '../src/insights/letter-top10-legend.js';
import { displayDimensions, ROLE_DIMENSION_LABELS, SCORE_FORMULA_LINES } from '../src/insights/letter-markdown-format.js';
import type { RoleEntry } from '../src/insights/letter-top10-unified.js';

/** 1.2.1: 오케 3차원(성능/속도/가성비, 사용량 가중 0)·라벨·범례·소스(AA/Cog) 검증. 워커 가중치·가산 불변.
 *  수치 계산은 core(w1) 소유 — 여기서는 렌더 구조·라벨·문구를 의미 있게 검사한다. */

test('ROLE_DIMENSION_LABELS: 오케 price는 가성비, 워커는 가격', () => {
  assert.equal(ROLE_DIMENSION_LABELS.orchestrator.price, '가성비');
  assert.equal(ROLE_DIMENSION_LABELS.worker.price, '가격');
  assert.deepEqual(displayDimensions('orchestrator'), ['performance', 'speed', 'price'], '오케는 3차원(사용량 가중 0 → 제외)');
});

test('dimensionsLabel: 오케 성능/속도/가성비 3열, 워커 성능/사용량/속도/가격', () => {
  assert.equal(dimensionsLabel('orchestrator'), '성능/속도/가성비');
  assert.equal(dimensionsLabel('worker'), '성능/사용량/속도/가격', '워커는 가격 칸(가성비 아님)');
});

test('dimensionsText: 오케는 성능/속도/가성비 3칸, 워커는 4칸(가성비는 * 없음)', () => {
  const sc = { index: 0.9, usage: 0.7, speed: 0.6, cost: 0.8, dimensionSources: { performance: 'aa', usage: 'openrouter', speed: 'aa', price: 'aa' } };
  const e = { scoreComponents: sc } as unknown as RoleEntry;
  assert.equal(dimensionsText(e, 'orchestrator'), '90/60/80', '오케 3번째 칸=가성비');
  assert.equal(dimensionsText(e, 'worker'), '90/70/60/80');
  const fb = { scoreComponents: { ...sc, priceFallback: true } } as unknown as RoleEntry;
  assert.equal(dimensionsText(fb, 'orchestrator'), '90/60/80', '오케 가성비는 * 대체 없음');
});

test('SCORE_FORMULA_LINES: 오케 가중치 75/10/15 + 가성비 공식 I/(P+.01)·Cog', () => {
  const weights = SCORE_FORMULA_LINES.find(l => l.includes('가중치:'))!;
  assert.ok(weights.includes('성능 75%·속도 10%·가성비 15%'), weights);
  const vfm = SCORE_FORMULA_LINES.find(l => l.includes('가성비:'))!;
  assert.ok(vfm.includes('I/(P+.01)') && vfm.includes('Cog') && vfm.includes('min-max'), vfm, '제곱 제거·log min-max 유지');
});

test('LEGEND_LINES: 오케 가성비 소스 AA·Cog와 결측 0 안내', () => {
  const line = LEGEND_LINES.find(l => l.includes('가성비: 오케'))!;
  assert.ok(line.includes('AA·Cog') && line.includes('I/(P+.01)') && line.includes('결측 0'), line);
});
