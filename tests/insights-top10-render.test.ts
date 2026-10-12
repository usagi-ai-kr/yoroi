import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTop10Letter, type Top10LetterInput } from '../src/insights/letter-top10-render.js';
import type { Top10Result } from '../src/insights/letter-top10-rank.js';

function fakeResult(prefix: string): Top10Result {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    rank: i + 1, modelId: `${prefix}-model-${i + 1}`, repEffort: 'high', indexValue: (95.0 - i * 2.5).toFixed(1),
    blendedCostText: '$2.00/1M', costEffRankText: `가성비 ${i + 1}위`,
    costText: `지수 ${(95.0 - i * 2.5).toFixed(1)} · $2.00/1M · 가성비 ${i + 1}위`,
    arenaRankText: i < 5 ? `Arena ${i + 1}위` : 'Arena -',
    openrouterRankText: i < 3 ? `OpenRouter ${i + 1}위` : 'OpenRouter -',
    isPareto: i % 2 === 0,
    change: i === 0 ? '유지' as const : i === 1 ? '▲1' as const : '신규' as const,
  }));
  return { entries, exits: [{ modelId: `${prefix}-old-model`, previousRank: 8, text: `이탈: ${prefix}-old-model(전일 8위)` }] };
}
test('renderTop10Letter renders optimum-zone rows, header phrase, pareto star and footer formulas', () => {
  const data: Top10LetterInput = { publicationDate: '2026-10-12', orchestrator: fakeResult('orch'),
    worker: fakeResult('worker'), failedSources: ['cognition'] };
  const rendered = renderTop10Letter(data);
  assert.ok(rendered.includes('[AI 인사이트 데일리: 2026-10-12 KST (내부 전용)]'));
  assert.ok(rendered.includes('가성비 최적 존: 지수 ≥ 최고의 85%(오케스트레이터)/75%(워커) 중 가성비 순 · ★ 파레토 최적'));
  assert.ok(rendered.includes('정렬: 가성비 순(무료 최상위) → OpenRouter 사용량 → 지수, 단가 미상 후순위'));
  assert.ok(!rendered.includes('가중치 재정규화'));
  assert.ok(rendered.includes('## 오케스트레이터 Top10 (판단·계획 / Intelligence Index)'));
  assert.ok(rendered.includes('1. orch-model-1 · effort high · 지수 95.0 · $2.00/1M · 가성비 1위'));
  for (const t of ['OpenRouter 1위', 'Arena 1위', '유지', '★']) assert.ok(rendered.includes(t), t);
  assert.ok(rendered.includes('• 이탈: orch-old-model (전일 8위)'));
  assert.ok(rendered.includes('## 워커 Top10 (실행·코딩 / Coding Index)'));
  assert.ok(rendered.includes('1. worker-model-1 · effort high · 지수 95.0'));
  assert.ok(rendered.includes('## 출처 및 안내'));
  for (const t of ['출처: lmarena-ai LMArena Leaderboard Dataset (CC-BY-4.0)', '출처: OpenRouter (CC-BY-4.0)',
    '출처: Artificial Analysis (라이선스 미확인)', '출처: Cognition FrontierCode (라이선스 미확인 · 내부 전용)',
    '수집 실패 소스: cognition', '혼합 단가=(3×입력+출력)/4 USD/1M · 가성비=지수÷max(단가,0.01)',
    '★ 파레토 최적은 더 싸고 더 좋은 모델이 없는 상태', '상세 지표는 SQLite 이력에서 확인할 수 있습니다.']) {
    assert.ok(rendered.includes(t), t);
  }
});
test('renderTop10Letter indicates all sources normal and keeps the whole compact under 3000 chars', () => {
  const data: Top10LetterInput = { publicationDate: '2026-10-12', orchestrator: fakeResult('long-vendor-org-name/long-model-name-extra-large-v1'),
    worker: fakeResult('long-vendor-org-name/long-worker-model-name-coding-v2'), failedSources: ['openrouter', 'cognition'] };
  const rendered = renderTop10Letter(data);
  assert.ok(!rendered.includes('수집 실패 소스: cognition'));
  assert.ok(rendered.includes('수집 실패 소스: openrouter'));
  assert.ok(rendered.length < 3000, `length ${rendered.length} >= 3000`);
});
test('renderTop10Letter summarizes all-new, partial-new, and no-new cohorts', () => {
  const mkResult = (changes: readonly ('신규' | '유지' | '▲1')[]) => ({
    entries: changes.map((change, i) => ({ rank: i + 1, modelId: `m-${i + 1}`, repEffort: 'high', indexValue: '90.0',
      blendedCostText: '$1.00/1M', costEffRankText: `가성비 ${i + 1}위`,
      costText: `지수 90.0 · $1.00/1M · 가성비 ${i + 1}위`, arenaRankText: 'Arena -', openrouterRankText: 'OpenRouter -',
      isPareto: false, change })),
    exits: [],
  });
  const allNew = renderTop10Letter({ publicationDate: '2026-10-12', orchestrator: mkResult(['신규', '신규']), worker: mkResult(['신규']) });
  assert.ok(allNew.includes('- 변동: 첫 집계: 전일 비교 기록 없음'));
  const partialNew = renderTop10Letter({ publicationDate: '2026-10-12', orchestrator: mkResult(['유지', '▲1']), worker: mkResult(['신규']) });
  assert.ok(partialNew.includes('- 변동: 상위권 3개 중 1개 순위·진입 변동 (신규 1개), 이탈 0개'));
  const regular = renderTop10Letter({ publicationDate: '2026-10-12', orchestrator: mkResult(['유지', '▲1']), worker: mkResult(['유지']) });
  assert.ok(regular.includes('- 변동: 상위권 3개 중 1개 순위·진입 변동, 이탈 0개'));
});
