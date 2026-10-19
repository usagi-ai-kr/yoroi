import assert from 'node:assert/strict';
import test from 'node:test';
import { LEGEND_HEADING, LEGEND_LINES, bonusSuffix, bonusText, changeNote, dimensionsText, exitLine, formatChange } from '../src/insights/letter-top10-legend.js';
import { renderTop10Markdown } from '../src/insights/letter-markdown.js';
import { renderTop10Letter } from '../src/insights/letter-top10-render.js';
import type { RoleChange, RoleEntry, RoleLists } from '../src/insights/letter-top10-unified.js';

const entry = (e: Partial<RoleEntry> & Pick<RoleEntry, 'rank' | 'modelId' | 'indexText' | 'change'>): RoleEntry =>
  ({ repEffort: 'high', blendedCostText: '$1.50', scoreText: (100 - e.rank).toFixed(1),
    plans: ['ChatGPT Plus'], isPareto: false, both: false, ...e });
const lists: RoleLists = {
  orchestrator: { entries: [
    entry({ rank: 1, modelId: 'orch-a', indexText: '85.0', isPareto: true, both: true, change: '▲2' }),
    entry({ rank: 2, modelId: 'orch-b', indexText: '80.0', change: '진입' }),
    entry({ rank: 3, modelId: 'orch-c', indexText: '75.0', change: '유지' }),
    entry({ rank: 4, modelId: 'orch-d', indexText: '-', change: '신규', belowZone: true, indexMissing: true }),
  ], exits: [{ modelId: 'orch-old', previousRank: 5 }] },
  worker: { entries: [entry({ rank: 1, modelId: 'work-a', indexText: '72.0', change: '▼3' })], exits: [] },
};

test('formatChange maps every role change to one fixed emoji', () => {
  assert.equal(formatChange('유지'), '➖');
  assert.equal(formatChange('진입'), '🆕');
  assert.equal(formatChange('신규'), '🌱');
  assert.equal(formatChange('▲4' as RoleChange), '▲4');
  assert.equal(formatChange('▼2' as RoleChange), '▼2');
  assert.equal(exitLine('m', 7), '🚪 이탈: m (전일 7위)');
});

test('changeNote uses 🌱 for the first cohort and 🚪 for exits', () => {
  assert.equal(changeNote('오케스트레이터', lists.orchestrator), '오케스트레이터 상위권 4개 중 2개 순위·진입 변동 (🆕 1개), 🚪 1개');
  assert.equal(changeNote('워커', { entries: [entry({ rank: 1, modelId: 'x', indexText: '1', change: '신규' })], exits: [] }),
    '🌱 워커 첫 집계: 전일 기록 없음');
});

test('the guide section lists every marker with one meaning', () => {
  assert.equal(LEGEND_LINES[0], LEGEND_HEADING);
  assert.equal(LEGEND_LINES.length, 9);
  for (const text of ['👍 파레토 최적(파레토 열)', '▲N / ▼N', '➖ 유지', '🆕 신규 진입', '🌱 첫 집계', '🚪 이탈',
    '▽ 하한 보충', '0~100 차원: 오케 성능/속도/가성비, 워커 성능/속도/가격',
    '속도: 오케 AA·Cog, 워커 AA 우선·Cog 대체', '- 가성비: 오케',
    '워커 intel<33·결측 제외', '워커는 AA intel ≥33만', '`*`=가격을 혼합 단가로 대체, 99=근거 없음', '+N=가산(최대 5점)', '⚠️ 한도·주의', '🔒 접근 제한', '🆓 무료']) assert.ok(LEGEND_LINES.some(l => l.includes(text)), text);
  assert.ok(LEGEND_LINES.some(l => l.includes('OR/OCD 워커 가산 전용(오케 점수 미반영)')));
});

test('dimension cells: orchestrator 성능/속도/가성비, worker 성능/사용량/속도/가격 (R 가성비 유지)', () => {
  const sc = { index: 0.9, cost: 0.8, usage: 0.7, speed: 0.6, dimensionSources: { performance: 'aa', usage: 'openrouter', speed: 'aa', price: 'aa' } };
  const e = { ...lists.orchestrator.entries[0]!, scoreComponents: sc };
  assert.equal(dimensionsText(e, 'orchestrator'), '90/60/80');
  assert.equal(dimensionsText(e, 'worker'), '90/70/60/80');
  const fb = { ...e, scoreComponents: { ...sc, priceFallback: true } };
  assert.equal(dimensionsText(fb, 'worker'), '90/70/60/80*', '혼합 단가 대체는 가격 칸에 *');
  assert.equal(dimensionsText(fb, 'orchestrator'), '90/60/80', '오케는 * 없음(*는 워커 전용)');
});

test('worker bonus shows +N.N points only for the worker and only when present', () => {
  const sc = { index: 0.9, cost: 0.8, usage: 0.7, speed: 0.6, dimensionSources: { performance: 'aa', speed: 'aa', price: 'aa' } };
  const withBonus = { ...lists.worker.entries[0]!, scoreComponents: { ...sc, bonus: 3.74 } }, without = { ...lists.worker.entries[0]!, scoreComponents: sc };
  assert.deepEqual([bonusText(withBonus, 'worker'), bonusText(without, 'worker'), bonusText(withBonus, 'orchestrator')], ['+3.7', '-', '-']);
  assert.deepEqual([bonusSuffix(withBonus, 'worker'), bonusSuffix(without, 'worker'), bonusSuffix(withBonus, 'orchestrator')], [' 가산 +3.7', '', '']);
});

test('markdown worker table adds a 가산 column and * marker; orchestrator shows 3 dims', () => {
  const sc = { index: 0.9, cost: 0.8, usage: 0, speed: 0.6, dimensionSources: { performance: 'aa', speed: 'aa', price: 'aa' }, bonus: 3.74, priceFallback: true };
  const custom: RoleLists = { ...lists, worker: { entries: [{ ...lists.worker.entries[0]!, scoreComponents: sc }], exits: [] } };
  const md = renderTop10Markdown({ publicationDate: '2026-10-13', lists: custom, failedSources: [] });
  assert.ok(md.includes('| 순위 | 파레토 | 모델 | 추천 effort | 스코어 | 성능/사용량/속도/가격 | 가산 | AA 지수 | 혼합 단가 | 변동 |'));
  assert.ok(md.includes('| 순위 | 파레토 | 모델 | 추천 effort | 스코어 | 성능/속도/가성비 | AA 지수 | 혼합 단가 | 변동 |'));
  assert.ok(md.includes('| work-a | high(미확인) | 99.0 | 90/-/60/80* | +3.7 | 72.0 | $1.50 | ▼3 |'), md);
  const compact = renderTop10Letter({ publicationDate: '2026-10-13', lists: custom });
  assert.ok(compact.includes('· 90/-/60/80* 가산 +3.7 · $1.50 ·'), compact);
});

test('both renderers place the guide under the two tables, outside the details block', () => {
  const md = renderTop10Markdown({ publicationDate: '2026-10-13', lists, failedSources: [] });
  const compact = renderTop10Letter({ publicationDate: '2026-10-13', lists });
  for (const text of [md, compact]) {
    assert.ok(text.includes(LEGEND_HEADING));
    assert.ok(text.indexOf('## 🛠️ 워커') < text.indexOf(LEGEND_HEADING));
    assert.ok(!text.includes('★'));
  }
  assert.ok(md.indexOf(LEGEND_HEADING) < md.indexOf('<details>'));
  assert.ok(compact.indexOf(LEGEND_HEADING) < compact.indexOf('## 출처 및 안내'));
  for (const line of LEGEND_LINES.slice(1)) assert.ok(compact.includes(line), line);
  assert.ok(!md.includes('- 교집합: 두 목록') && !md.includes('- ★ 파레토 최적'));
});

test('belowZone rows carry ▽ in the rank cell and indexMissing keeps the dash', () => {
  const md = renderTop10Markdown({ publicationDate: '2026-10-13', lists, failedSources: [] });
  const compact = renderTop10Letter({ publicationDate: '2026-10-13', lists });
  assert.ok(md.includes('| ▽ 4 |  | orch-d | high(미확인) | 96.0 | - | - | $1.50 | 🌱 |'), md);
  assert.ok(compact.includes('▽ 4. orch-d · effort high · 스코어 96.0 · - · $1.50 · 접근 ChatGPT Plus · 🌱'), compact);
  assert.ok(!md.includes('| ▽ 1 |') && !compact.includes('▽ 1.'));
});
