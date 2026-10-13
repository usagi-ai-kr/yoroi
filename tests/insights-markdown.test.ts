import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeShields, renderTop10Markdown, renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import type { RoleEntry, RoleLists } from '../src/insights/letter-markdown.js';
import { EXCLUSION_NOTE } from '../src/insights/top10-policy.js';
import { SOURCE_LINES } from '../src/insights/letter-markdown-format.js';

const entry = (e: Partial<RoleEntry> & Pick<RoleEntry, 'rank' | 'modelId' | 'indexText' | 'change'>): RoleEntry =>
  ({ repEffort: 'high', blendedCostText: '$1.50', costEffRankText: '-', scoreText: (100 - e.rank).toFixed(1),
    plans: ['ChatGPT Plus'], isPareto: false, both: false, ...e });
const LISTS: RoleLists = {
  orchestrator: {
    entries: [
      entry({ rank: 1, modelId: 'provider/orch-model', indexText: '85.5', repEffort: 'high',
        blendedCostText: '$1.50', scoreText: '78.4', openrouterRankText: 'OpenRouter 3위',
        isPareto: true, both: true, change: '신규' }),
      entry({ rank: 2, modelId: 'provider/orch-up', indexText: '80.0', repEffort: 'default',
        blendedCostText: '$0.50', scoreText: '71.2', change: '▲2' }),
      entry({ rank: 3, modelId: 'provider/orch-new', indexText: '76.0', change: '진입' }),
      entry({ rank: 4, modelId: 'provider/orch-hold', indexText: '75.0', change: '유지' }),
    ],
    exits: [{ modelId: 'provider/orch-old', previousRank: 5 }],
  },
  worker: {
    entries: [entry({ rank: 1, modelId: 'provider/worker-down', indexText: '75.0', repEffort: 'default',
      blendedCostText: '$0.20', scoreText: '66.9', plans: ['Ollama Cloud Pro'], change: '▼1' })],
    exits: [],
  },
};
const makeFixture = (): { publicationDate: string; lists: RoleLists; failedSources?: readonly string[] } =>
  ({ publicationDate: '2026-10-12', lists: LISTS, failedSources: ['synthetic-source'] });

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
  assert.ok(md.includes('![date](https://img.shields.io/badge/date-2026--10--12-blue)'));
  assert.ok(md.includes(`![sources](https://img.shields.io/badge/sources-${SOURCE_LINES.length}_total-informational)`));
  assert.ok(md.includes('![status](https://img.shields.io/badge/status-1_failed-critical)'));

  const healthyMd = renderTop10Markdown({ ...fixture, failedSources: [] });
  assert.ok(healthyMd.includes('![status](https://img.shields.io/badge/status-all_healthy-success)'));

  for (const emoji of ['🧭', '🛠️', '⭐', '🆕', '🌱', '➖', '🚪']) assert.ok(md.includes(emoji), emoji);

  assert.ok(md.includes('## 🧭 오케스트레이터 Top10 (판단·계획 / Intelligence Index)'));
  assert.ok(md.includes('## 🛠️ 워커 Top10 (실행·코딩 / Coding Index)'));
  const expectedHeader = '| 순위 | 모델 | 추천 effort | 스코어 | 지수 | 혼합 단가 | 변동 |';
  assert.ok(md.includes(expectedHeader));
  assert.ok(md.includes('| --- | --- | --- | --- | --- | --- | --- |'));
  assert.ok(md.includes('| ⭐ 1 | provider/orch-model ↔ | high | 78.4 | 85.5 | $1.50 | 🌱 |'));
  assert.ok(md.includes('| 2 | provider/orch-up | default | 71.2 | 80.0 | $0.50 | ▲2 |'));
  assert.ok(md.includes('| 3 | provider/orch-new | high | 97.0 | 76.0 | $1.50 | 🆕 |'));
  assert.ok(md.includes('| 4 | provider/orch-hold | high | 96.0 | 75.0 | $1.50 | ➖ |'));
  assert.ok(md.includes('| 1 | provider/worker-down | default | 66.9 | 75.0 | $0.20 | ▼1 |'));
  assert.ok(md.includes('🚪 이탈: provider/orch-old (전일 5위)'));

  assert.ok(md.includes('<details><summary>출처 및 산출 공식</summary>'));
  assert.ok(!md.includes('오케스트레이터 점수 = 지수 50%'));
  assert.ok(!md.includes('워커 점수 = 코딩 35%'));
  assert.ok(md.includes('- 자격: 오케스트레이터 지능 ≥ 후보 최고 85% · 워커 코딩 ≥ 후보 최고 75% · 보유 요금제 접근 모델만'));
  assert.ok(md.includes('## 📖 표시 안내') && md.includes('- ↔ 양쪽 목록 교집합: 오케스트레이터·워커 두 목록 모두에 오른 모델') && !md.includes('- 교집합: 두 목록에 모두 오르는 모델'));
  assert.ok(md.includes('- 혼합 단가=(3×입력+출력)/4 USD/1M'));
  assert.ok(!md.includes('가성비=지수÷max'));
  assert.ok(md.includes('- 스코어 = 100 × Σ(가중치 × 정규화값), 스코어 내림차순 정렬(동점 시 지수)'));
  assert.ok(md.includes('- 가중치 오케스트레이터: 지수 0.4 · 비용 0.4 · 사용량 0.15 · 속도 0.05 / 워커: 지수 0.3 · 비용 0.4 · 사용량 0.1 · 속도 0.2'));
  assert.ok(md.includes('- 정규화: 역할별 후보 풀 min-max(비용·사용량·속도는 log10, 싼 쪽·빠른 쪽 1), 단가 결측 0·사용량 결측 0·속도 결측 중앙값'));
  assert.ok(md.includes('- 추천 effort: 변형별 실효 단가(혼합 단가 × cost_per_task 비율)로 스코어링한 최고 변형'));
  assert.ok(md.includes('- default: AA에 effort 변형 또는 cost_per_task가 없어 단일 구성으로 평가'));
  assert.ok(!md.includes('정렬: 가성비 중 큰 값'));
  assert.ok(md.includes(`- ${EXCLUSION_NOTE}`));
  assert.ok(md.includes('- ⭐ 파레토 최적: 더 싸고 더 좋은 모델이 없는 상태(가성비 경계선)') && !md.includes('- ★ 파레토 최적'));
  assert.ok(md.includes('⚠️ synthetic-source'));
  assert.ok(md.includes('OpenRouter'));
  assert.ok(md.includes('Artificial Analysis'));
  assert.ok(md.includes('Cognition FrontierCode'));
  assert.ok(md.includes('</details>'));

  assert.ok(md.length <= 65536 && md.length > 0);
});

test('renderTop10MarkdownFromRecords computes and renders markdown correctly', () => {
  const records = [{ modelId: 'claude-opus-5-5', value: 90, metric: 'artificial_analysis_intelligence_index', priceInput: 1.1, priceOutput: 4.4 },
    { modelId: 'gpt-6-1-sol', value: 80, metric: 'artificial_analysis_coding_index', priceInput: 3, priceOutput: 15 }];
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-12', records });
  assert.ok(md.startsWith('# AI 인사이트 데일리: 2026-10-12 KST'));
  assert.ok(md.includes('🧭') && md.includes('🛠️'));
  assert.ok(md.length <= 65536);
  const withOr = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-12', records,
    openrouterRecords: [{ modelId: 'gpt-6-1-sol', value: 264308530787, metric: 'total_tokens' }] });
  assert.ok(!withOr.includes('264308530787') && /\| ⭐ 1 \| claude-opus-5-5/.test(withOr), withOr);
});
