import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTop10Letter, type Top10LetterInput } from '../src/insights/letter-top10-render.js';
import type { RoleEntry, RoleExit, RoleLists } from '../src/insights/letter-top10-unified.js';

function fakeLists(prefix: string): RoleLists {
  const entries = (): RoleEntry[] => Array.from({ length: 10 }, (_, i) => ({
    rank: i + 1, modelId: `${prefix}-model-${i + 1}`, indexText: (95.0 - i * 2.5).toFixed(1), repEffort: 'high',
    scoreText: (90.0 - i * 3).toFixed(1), blendedCostText: '$2.00/1M', costEffRankText: `가성비 ${i + 1}위`, plans: ['ChatGPT Plus'],
    arenaRankText: i < 5 ? `Arena ${i + 1}위` : 'Arena -',
    openrouterRankText: i < 3 ? `OpenRouter ${i + 1}위` : 'OpenRouter -',
    isPareto: i % 2 === 0, both: i < 2,
    change: i === 0 ? '유지' as const : i === 1 ? '▲1' as const : '신규' as const }));
  const exits: RoleExit[] = [{ modelId: `${prefix}-old-model`, previousRank: 8 }];
  return { orchestrator: { entries: entries(), exits }, worker: { entries: entries(), exits } };
}
test('renderTop10Letter renders both role sections, header phrase, pareto star and footer formulas', () => {
  const data: Top10LetterInput = { publicationDate: '2026-10-12', lists: fakeLists('unified'), failedSources: ['cognition'] };
  const rendered = renderTop10Letter(data);
  assert.ok(rendered.includes('[AI 인사이트 데일리: 2026-10-12 KST (내부 전용)]'));
  assert.ok(rendered.includes('두 목록 Top10: 오케스트레이터 존(지능 ≥ 후보 최고 85%)·워커 존(코딩 ≥ 후보 최고 75%) 통과 모델, 보유 요금제 접근 가능만'));
  assert.ok(rendered.includes('정렬: 스코어 내림차순(동점 시 지수)'));
  assert.ok(rendered.includes('스코어 = 100 × Σ(가중치 × 정규화값)'));
  assert.ok(!rendered.includes('가성비=지수÷max'));
  assert.ok(!rendered.includes('가중치 재정규화'));
  assert.ok(rendered.includes('## 🧭 오케스트레이터 Top10 (판단·계획 / Intelligence Index)'));
  assert.ok(rendered.includes('## 🛠️ 워커 Top10 (실행·코딩 / Coding Index)'));
  assert.ok(rendered.includes('- 선두: 오케스트레이터 unified-model-1 (95.0) · 워커 unified-model-1 (95.0)'));
  assert.ok(rendered.includes('1. unified-model-1 ↔ · effort high · 스코어 90.0 · 95.0 · $2.00/1M · 접근 ChatGPT Plus'));
  assert.ok(rendered.includes('3. unified-model-3 · effort high · 스코어 84.0 · 90.0 · $2.00/1M · 접근 ChatGPT Plus'));
  assert.ok(!rendered.includes('가성비 1위 · 접근'));
  for (const t of ['OpenRouter 1위', 'Arena 1위', '유지', '★']) assert.ok(rendered.includes(t), t);
  assert.ok(rendered.includes('• 이탈: unified-old-model (전일 8위)'));
  assert.ok(rendered.includes('## 출처 및 안내'));
  for (const t of ['출처: lmarena-ai LMArena Leaderboard Dataset (CC-BY-4.0)', '출처: OpenRouter (CC-BY-4.0)',
    '출처: Artificial Analysis (라이선스 미상)', '출처: Cognition FrontierCode (라이선스 미상 · 내부 전용)',
    '출처: OpenCode Data (내부 참조 · 약관상 자동 추출 제한) (라이선스 미상)',
    '수집 실패 소스: cognition', '혼합 단가=(3×입력+출력)/4 USD/1M',
    '상세 지표는 SQLite 이력에서 확인할 수 있습니다.']) {
    assert.ok(rendered.includes(t), t);
  }
});
test('renderTop10Letter indicates all sources normal and keeps the whole compact under the 3600-char budget', () => {
  const data: Top10LetterInput = { publicationDate: '2026-10-12',
    lists: fakeLists('long-vendor-org-name/long-model-name-extra-large-v1'), failedSources: ['openrouter', 'cognition'] };
  const rendered = renderTop10Letter(data);
  assert.ok(!rendered.includes('수집 실패 소스: cognition'));
  assert.ok(rendered.includes('수집 실패 소스: openrouter'));
  assert.ok(rendered.length < 3600, `length ${rendered.length} >= 3600`);
});
test('renderTop10Letter summarizes all-new, partial-new, and no-new cohorts per list', () => {
  const mkLists = (changes: readonly ('신규' | '유지' | '▲1')[]): RoleLists => ({
    orchestrator: { entries: changes.map((change, i) => ({ rank: i + 1, modelId: `m-${i + 1}`, indexText: '90.0',
      repEffort: 'high', blendedCostText: '$1.00/1M', costEffRankText: `가성비 ${i + 1}위`, plans: ['ChatGPT Plus'],
      arenaRankText: 'Arena -', openrouterRankText: 'OpenRouter -', isPareto: false, both: false, change })), exits: [] },
    worker: { entries: [], exits: [] } });
  const allNew = renderTop10Letter({ publicationDate: '2026-10-12', lists: mkLists(['신규', '신규']) });
  assert.ok(allNew.includes('- 변동: 오케스트레이터 첫 집계: 전일 비교 기록 없음 · 워커 자료 부족'));
  const partialNew = renderTop10Letter({ publicationDate: '2026-10-12', lists: mkLists(['유지', '▲1', '신규']) });
  assert.ok(partialNew.includes('- 변동: 오케스트레이터 상위권 3개 중 1개 순위·진입 변동 (신규 1개), 이탈 0개 · 워커 자료 부족'));
  const regular = renderTop10Letter({ publicationDate: '2026-10-12', lists: mkLists(['유지', '▲1', '유지']) });
  assert.ok(regular.includes('- 변동: 오케스트레이터 상위권 3개 중 1개 순위·진입 변동, 이탈 0개 · 워커 자료 부족'));
});

test('partial sources are reported instead of claiming all sources are normal', () => {
  const data: Top10LetterInput = { publicationDate: '2026-10-12', lists: fakeLists('unified'),
    partialSources: ['cognition'] };
  const rendered = renderTop10Letter(data);
  assert.ok(rendered.includes('부분 수집 소스: cognition'));
  const both = renderTop10Letter({ ...data, failedSources: ['opencode-data'] });
  assert.ok(both.includes('수집 실패 소스: opencode-data') && both.includes('부분 수집 소스: cognition'));
  assert.ok(!both.includes('전 소스 정상 수집'));
});
