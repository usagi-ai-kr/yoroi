import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeShields, renderTop10Markdown, renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import type { Top10LetterInput } from '../src/insights/letter-markdown.js';
import type { Top10Result } from '../src/insights/letter-top10-rank.js';
import { EXCLUSION_NOTE } from '../src/insights/top10-policy.js';
import { SOURCE_LINES } from '../src/insights/letter-markdown-format.js';

function makeFixture(): Top10LetterInput {
  const orchestrator: Top10Result = {
    entries: [
      { rank: 1, modelId: 'provider/orch-model', repEffort: 'high', indexValue: '85.5', blendedCostText: '$1.50',
        costEffRankText: '1위', costText: '$1.50', openrouterRankText: '3위', arenaRankText: '2위', isPareto: true, change: '신규' },
      { rank: 2, modelId: 'provider/orch-up', repEffort: 'default', indexValue: '80.0', blendedCostText: '$0.50',
        costEffRankText: '2위', costText: '$0.50', openrouterRankText: '10위', arenaRankText: '5위', isPareto: false, change: '▲2' },
    ],
    exits: [{ modelId: 'provider/orch-old', previousRank: 5, text: '이탈' }],
  };
  const worker: Top10Result = {
    entries: [
      { rank: 1, modelId: 'provider/worker-down', repEffort: 'default', indexValue: '75.0', blendedCostText: '$0.20',
        costEffRankText: '1위', costText: '$0.20', openrouterRankText: '-', arenaRankText: '-', isPareto: false, change: '▼1' },
    ],
    exits: [],
  };
  return { publicationDate: '2026-10-12', orchestrator, worker, failedSources: ['synthetic-source'] };
}

test('escapeShields escapes hyphens, underscores, and spaces according to shields.io spec', () => {
  assert.equal(escapeShields('2026-10-12'), '2026--10--12');
  assert.equal(escapeShields('foo_bar'), 'foo__bar');
  assert.equal(escapeShields('4 total'), '4_total');
  assert.equal(escapeShields('all healthy'), 'all_healthy');
  assert.equal(escapeShields('1 failed'), '1_failed');
});

test('renderTop10Markdown renders shields.io badges, emojis, tables, details, length limit', () => {
  const fixture = makeFixture();
  const md = renderTop10Markdown(fixture);

  // 1. shields.io 배지 (date, sources, status)
  assert.ok(md.includes('![date](https://img.shields.io/badge/date-2026--10--12-blue)'));
  assert.ok(md.includes(`![sources](https://img.shields.io/badge/sources-${SOURCE_LINES.length}_total-informational)`));
  assert.ok(md.includes('![status](https://img.shields.io/badge/status-1_failed-critical)'));

  // all healthy status badge
  const healthyMd = renderTop10Markdown({ ...fixture, failedSources: [] });
  assert.ok(healthyMd.includes('![status](https://img.shields.io/badge/status-all_healthy-success)'));

  // 2. 이모지 6종 검증 (🧭, 🛠️, ⭐, 🆕, 🔼, 🔽)
  for (const emoji of ['🧭', '🛠️', '⭐', '🆕', '🔼', '🔽']) {
    assert.ok(md.includes(emoji), `Expected markdown to include ${emoji}`);
  }

  // 3. 마크다운 테이블 문법 검증
  const expectedHeader = '| 순위 | 모델 | 추천 effort | 지수 | 혼합 단가 | 가성비 | OR 사용량 | 변동 |';
  assert.ok(md.includes(expectedHeader));
  assert.ok(md.includes('| --- | --- | --- | --- | --- | --- | --- | --- |'));
  assert.ok(md.includes('| ⭐ 1 | provider/orch-model | high | 85.5 | $1.50 | 1위 | 3위 | 🆕 신규 |'));
  assert.ok(md.includes('| 2 | provider/orch-up | default | 80.0 | $0.50 | 2위 | 10위 | 🔼 2 |'));
  assert.ok(md.includes('| 1 | provider/worker-down | default | 75.0 | $0.20 | 1위 | - | 🔽 1 |'));
  assert.ok(md.includes('• 이탈: provider/orch-old (전일 5위)'));

  // 4. <details> 산출 공식 및 정책 검증 (폐기된 가중합 제거 확인)
  assert.ok(md.includes('<details><summary>출처 및 산출 공식</summary>'));
  assert.ok(!md.includes('오케스트레이터 점수 = 지수 50%'));
  assert.ok(!md.includes('워커 점수 = 코딩 35%'));
  assert.ok(md.includes('가성비 최적 존: 지수 ≥ 최고의 85%(오케스트레이터)/75%(워커) 중 가성비 순 · ★ 파레토 최적'));
  assert.ok(md.includes('혼합 단가=(3×입력+출력)/4 USD/1M · 가성비=지수÷max(단가,0.01)'));
  assert.ok(md.includes('정렬: 가성비 순(무료 최상위) → OpenRouter 사용량 → 속도 → 지수, 단가 미상 후순위'));
  assert.ok(md.includes(`- ${EXCLUSION_NOTE}`));
  assert.ok(md.includes('★ 파레토 최적: 더 싸고 더 좋은 모델이 없는 상태'));
  assert.ok(md.includes('⚠️ synthetic-source'));
  assert.ok(md.includes('LMArena'));
  assert.ok(md.includes('OpenRouter'));
  assert.ok(md.includes('Artificial Analysis'));
  assert.ok(md.includes('Cognition FrontierCode'));
  assert.ok(md.includes('</details>'));

  // 5. 65,536자 이하 검증
  assert.ok(md.length <= 65536 && md.length > 0);
});

test('renderTop10MarkdownFromRecords computes and renders markdown correctly', () => {
  const records = [
    { modelId: 'openai/o3-mini', value: 85, metric: 'intelligence_index', priceInput: 1.1, priceOutput: 4.4 },
    { modelId: 'anthropic/claude-3-7-sonnet', value: 83, metric: 'intelligence_index', priceInput: 3, priceOutput: 15 },
  ];
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-12', records });
  assert.ok(md.startsWith('# AI 인사이트 데일리: 2026-10-12 KST'));
  assert.ok(md.includes('🧭'));
  assert.ok(md.includes('🛠️'));
  assert.ok(md.length <= 65536);
});
