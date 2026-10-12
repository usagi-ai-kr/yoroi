import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTop10Letter, type Top10LetterInput } from '../src/insights/letter-top10-render.js';
import type { UnifiedResult } from '../src/insights/letter-top10-unified.js';

function fakeUnifiedResult(prefix: string): UnifiedResult {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    rank: i + 1, modelId: `${prefix}-model-${i + 1}`, roles: ['orchestrator'] as const, roleLabel: '🧭 오케',
    repEffort: 'high', indexText: `오케 ${(95.0 - i * 2.5).toFixed(1)}`,
    blendedCostText: '$2.00/1M', costEffRankText: `가성비 ${i + 1}위`, plans: ['ChatGPT Plus'],
    arenaRankText: i < 5 ? `Arena ${i + 1}위` : 'Arena -',
    openrouterRankText: i < 3 ? `OpenRouter ${i + 1}위` : 'OpenRouter -',
    isPareto: i % 2 === 0,
    change: i === 0 ? '유지' as const : i === 1 ? '▲1' as const : '신규' as const,
  }));
  return { entries, exits: [{ modelId: `${prefix}-old-model`, previousRank: 8 }] };
}
test('renderTop10Letter renders optimum-zone rows, header phrase, pareto star and footer formulas', () => {
  const data: Top10LetterInput = { publicationDate: '2026-10-12', unified: fakeUnifiedResult('unified'), failedSources: ['cognition'] };
  const rendered = renderTop10Letter(data);
  assert.ok(rendered.includes('[AI 인사이트 데일리: 2026-10-12 KST (내부 전용)]'));
  assert.ok(rendered.includes('통합 Top10: 오케스트레이터 존(지능 ≥ 후보 최고 85%)·워커 존(코딩 ≥ 후보 최고 75%) 통과 모델, 보유 요금제 접근 가능만'));
  assert.ok(rendered.includes('정렬: 가성비 중 큰 값 → OR 사용량 → 속도 → 지수'));
  assert.ok(!rendered.includes('가중치 재정규화'));
  assert.ok(rendered.includes('## 🏆 통합 Top10 (추천 역할 · 지수 · 가성비)'));
  assert.ok(rendered.includes('1. unified-model-1 · 🧭 오케 · effort high · 오케 95.0 · $2.00/1M · 가성비 1위 · 접근 ChatGPT Plus'));
  for (const t of ['OpenRouter 1위', 'Arena 1위', '유지', '★']) assert.ok(rendered.includes(t), t);
  assert.ok(rendered.includes('• 이탈: unified-old-model (전일 8위)'));
  assert.ok(rendered.includes('## 출처 및 안내'));
  for (const t of ['출처: lmarena-ai LMArena Leaderboard Dataset (CC-BY-4.0)', '출처: OpenRouter (CC-BY-4.0)',
    '출처: Artificial Analysis (라이선스 미상)', '출처: Cognition FrontierCode (라이선스 미상 · 내부 전용)',
    '출처: OpenCode Data (내부 참조 · 약관상 자동 추출 제한) (라이선스 미상)',
    '수집 실패 소스: cognition', '혼합 단가=(3×입력+출력)/4 USD/1M · 가성비=지수÷max(단가,0.01)',
    '상세 지표는 SQLite 이력에서 확인할 수 있습니다.']) {
    assert.ok(rendered.includes(t), t);
  }
});
test('renderTop10Letter indicates all sources normal and keeps the whole compact under 3000 chars', () => {
  const data: Top10LetterInput = { publicationDate: '2026-10-12',
    unified: fakeUnifiedResult('long-vendor-org-name/long-model-name-extra-large-v1'), failedSources: ['openrouter', 'cognition'] };
  const rendered = renderTop10Letter(data);
  assert.ok(!rendered.includes('수집 실패 소스: cognition'));
  assert.ok(rendered.includes('수집 실패 소스: openrouter'));
  assert.ok(rendered.length < 3000, `length ${rendered.length} >= 3000`);
});
test('renderTop10Letter summarizes all-new, partial-new, and no-new cohorts', () => {
  const mkResult = (changes: readonly ('신규' | '유지' | '▲1')[]): UnifiedResult => ({
    entries: changes.map((change, i) => ({ rank: i + 1, modelId: `m-${i + 1}`, roles: ['orchestrator'] as const, roleLabel: '🧭 오케',
      repEffort: 'high', indexText: '오케 90.0', blendedCostText: '$1.00/1M', costEffRankText: `가성비 ${i + 1}위`, plans: ['ChatGPT Plus'],
      arenaRankText: 'Arena -', openrouterRankText: 'OpenRouter -', isPareto: false, change })),
    exits: [],
  });
  const allNew = renderTop10Letter({ publicationDate: '2026-10-12', unified: mkResult(['신규', '신규']) });
  assert.ok(allNew.includes('- 변동: 첫 집계: 전일 비교 기록 없음'));
  const partialNew = renderTop10Letter({ publicationDate: '2026-10-12', unified: mkResult(['유지', '▲1', '신규']) });
  assert.ok(partialNew.includes('- 변동: 상위권 3개 중 1개 순위·진입 변동 (신규 1개), 이탈 0개'));
  const regular = renderTop10Letter({ publicationDate: '2026-10-12', unified: mkResult(['유지', '▲1', '유지']) });
  assert.ok(regular.includes('- 변동: 상위권 3개 중 1개 순위·진입 변동, 이탈 0개'));
});

test('partial sources are reported instead of claiming all sources are normal', () => {
  const data: Top10LetterInput = { publicationDate: '2026-10-12', unified: fakeUnifiedResult('unified'),
    partialSources: ['cognition'] };
  const rendered = renderTop10Letter(data);
  assert.ok(rendered.includes('부분 수집 소스: cognition'));
  const both = renderTop10Letter({ ...data, failedSources: ['opencode-data'] });
  assert.ok(both.includes('수집 실패 소스: opencode-data') && both.includes('부분 수집 소스: cognition'));
  assert.ok(!both.includes('전 소스 정상 수집'));
});
