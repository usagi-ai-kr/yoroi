import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeShields, renderTop10Markdown, renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import type { RoleEntry, RoleLists } from '../src/insights/letter-markdown.js';
import { EXCLUSION_NOTE } from '../src/insights/top10-policy.js';
import { SOURCE_LINES } from '../src/insights/letter-markdown-format.js';
const entry = (e: Partial<RoleEntry> & Pick<RoleEntry, 'rank' | 'modelId' | 'indexText' | 'change'>): RoleEntry =>
  ({ repEffort: 'high', blendedCostText: '$1.50', scoreText: (100 - e.rank).toFixed(1),
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

  for (const emoji of ['🧭', '🛠️', '👍', '🆕', '🌱', '➖', '🚪']) assert.ok(md.includes(emoji), emoji);

  for (const h of ['## 🧭 오케스트레이터·리뷰어 Top', '## 🛠️ 워커 Top']) for (const n of ['7 ', '15 ']) assert.ok(md.includes(h + n), h + n);
  const orchHeader = '| 순위 | 파레토 | 모델 | 추천 effort | 스코어 | 성능/속도/가성비 | AA 지수 | 혼합 단가 | 변동 |';
  const workerHeader = '| 순위 | 파레토 | 모델 | 추천 effort | 스코어 | 성능/사용량/속도/가격 | 가산 | AA 지수 | 혼합 단가 | 변동 |';
  assert.equal(md.split(orchHeader).length - 1, 2); assert.equal(md.split(workerHeader).length - 1, 2);
  assert.ok(md.includes('| --- | --- | --- | --- | --- | --- | --- | --- |'));
  // #194: effort 칸은 plain(high/default)만 — (미확인) 표기 없음.
  assert.ok(md.includes('| 1 | 👍 | provider/orch-model | high | 78.4 | - | 85.5 | $1.50 | 🌱 |'));
  assert.ok(md.includes('| 2 |  | provider/orch-up | default | 71.2 | - | 80.0 | $0.50 | ▲2 |'));
  assert.ok(md.includes('| 3 |  | provider/orch-new | high | 97.0 | - | 76.0 | $1.50 | 🆕 |'));
  assert.ok(md.includes('| 4 |  | provider/orch-hold | high | 96.0 | - | 75.0 | $1.50 | ➖ |'));
  assert.ok(md.includes('| 1 |  | provider/worker-down | default | 66.9 | - | - | 75.0 | $0.20 | ▼1 |'));
  assert.ok(!md.includes('(미확인)') && !md.includes('(상한)'), 'effort 미확인·상한 표기가 출력에 없다');
  assert.ok(md.includes('🚪 이탈: provider/orch-old (전일 5위)'));

  assert.ok(md.includes('<details><summary>출처 및 산출 공식</summary>'));
  assert.ok(!md.includes('오케스트레이터 점수 = 지수 50%') && !md.includes('워커 점수 = 코딩 35%'));
  assert.ok(md.includes('- 자격: 스코어 ≥ 후보 최고 스코어 × 85%(오케스트레이터·리뷰어)/60%(워커) · 네 차원 중 하나 이상 근거(검증 Free 경로 포함)·워커 AA intel 원값 하한 통과 · 보유 요금제 접근 모델만'));
  assert.ok(md.includes('## 📖 표시 안내') && !md.includes('↔') && !md.includes('- 교집합: 두 목록에 모두 오르는 모델'));
  assert.ok(md.includes('- 혼합 단가=(3×입력+출력)/4 USD/1M'));
  assert.ok(md.includes('- 성능: 오케 AA Int·Cog, 워커 AA Int; 사용량: OR/OCD는 워커 가산 전용; 속도: 오케 AA·Cog, 워커 AA 우선·오케 Cog 대체'));
  assert.ok(md.includes('가성비: 오케') && md.includes('I/(P+.01)'), 'R: 오케 가성비 문구 있음(선형, 제곱 없음)');
  assert.ok(!md.includes('오케 사용량:') && !md.includes('오케 OR/OCD'));
  assert.ok(md.includes('- 스코어 = 100 × Σ(가중치 × 차원값), 결측 0점(재분배 없음), 동점 모델명'));
  assert.ok(md.includes('- 가중치: 오케·리뷰어 성능 75%·속도 10%·가성비 15% / 워커 성능 30%·사용량 20%·속도 10%·가격 40%'));
  assert.ok(md.includes('- 워커 intel ≥33(결측 제외); 오케 E=전 변형 풀 표준화·P1 최고점(성능·가성비 고려, 동점 낮은 effort); AA 지수도 E값'));
  assert.ok(md.includes('가산 = 5×평균(Cog 정답률·사용량, 있는 것만)') && md.includes('(없으면 혼합 단가 `*`)') && !md.includes('검증 Free 경로=0') && !md.includes('AA 참고'));
  assert.ok(!md.includes('정렬: 가성비 중 큰 값') && md.includes('오케 E=전 변형 풀 표준화·P1 최고점(성능·가성비 고려, 동점 낮은 effort)'), 'R 가성비 문구');
  assert.ok(md.includes(`- ${EXCLUSION_NOTE}`));
  assert.ok(md.includes('- 👍 파레토 최적(파레토 열): 더 싸고 더 좋은 모델이 없는 상태(단가 대비 스코어 경계선)') && !md.includes('⭐'));
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
  assert.ok(!withOr.includes('264308530787') && /\| 1 \| 👍 \| claude-opus-5-5/.test(withOr), withOr);
});
