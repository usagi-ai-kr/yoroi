import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTop10Letter, type Top10LetterInput } from '../src/insights/letter-top10-render.js';
import type { RoleEntry, RoleExit, RoleLists } from '../src/insights/letter-top10-unified.js';

function fakeLists(prefix: string, withDimensions = false): RoleLists {
  const entries = (): RoleEntry[] => Array.from({ length: 10 }, (_, i) => ({
    rank: i + 1, modelId: `${prefix}-model-${i + 1}`, indexText: (95.0 - i * 2.5).toFixed(1), repEffort: 'high',
    scoreText: (90.0 - i * 3).toFixed(1), blendedCostText: '$2.00/1M', plans: ['ChatGPT Plus'],
    ...(withDimensions && { scoreComponents: { index: 1, cost: 0.75, usage: 0.4, speed: 0.5,
      dimensionSources: { performance: 'aa', usage: 'openrouter', speed: 'aa', price: 'aa' } } }),
    openrouterRankText: i < 3 ? `OpenRouter ${i + 1}위` : 'OpenRouter -',
    isPareto: i % 2 === 0, both: i < 2,
    change: i === 0 ? '유지' as const : i === 1 ? '▲1' as const : '신규' as const }));
  const exits: RoleExit[] = [{ modelId: `${prefix}-old-model`, previousRank: 8 }];
  return { orchestrator: { entries: entries(), exits }, worker: { entries: entries(), exits } };
}
test('renderTop10Letter renders both role sections, header phrase, pareto star and footer formulas', () => {
  const data: Top10LetterInput = { publicationDate: '2026-10-12', lists: fakeLists('unified', true), failedSources: ['cognition'] };
  const rendered = renderTop10Letter(data);
  assert.ok(rendered.includes('[AI 인사이트 데일리: 2026-10-12 KST (내부 전용)]'));
  assert.ok(rendered.includes('두 목록 Top10: 스코어 ≥ 후보 최고 스코어 × 85%(오케스트레이터·리뷰어)/60%(워커·메신저) 통과 모델, 보유 요금제 접근 가능만'));
  assert.ok(rendered.includes('정렬: 스코어 내림차순(동점 시 모델명)'));
  assert.ok(rendered.includes('스코어 = 100 × Σ(가중치 × 차원값)'));
  assert.ok(rendered.includes('오케·리뷰어 성능 82%·사용량 6%·속도 12% / 워커'));
  assert.ok(rendered.includes('워커·메신저 성능 30%·사용량 20%·속도 10%·가격 40%'));
  assert.ok(rendered.includes('워커 intel ≥33(결측 제외); 오케 E=전 변형 풀 표준화·P1 최고점'));
  assert.ok(rendered.includes('속도: 오케 AA·Cog, 워커 AA') && rendered.includes('워커 가격 = cost_per_task·total_cost log 역방향 min-max 평균(없으면 혼합 단가 `*`); 가산 = 5×평균(Cog 정답률·사용량, 있는 것만)'));
  assert.ok(!rendered.includes('오케 가성비') && !rendered.includes('I²/P') && !rendered.includes('성능·가성비 고려'), 'p75: 오케 가성비 문구 없음');
  assert.ok(!rendered.includes('오케 사용량') && !rendered.includes('오케·리뷰어 사용량'));
  assert.ok(rendered.includes('off-peak·파레토, score 원 API'));
  assert.ok(!rendered.includes('가중치 재정규화'));
  assert.ok(rendered.includes('## 🧭 오케스트레이터·리뷰어 Top10 (판단·계획·검토)'));
  assert.ok(rendered.includes('## 🛠️ 워커·메신저 Top10 (실행·코딩·전달)'));
  assert.ok(rendered.includes('- 선두: 오케스트레이터·리뷰어 unified-model-1 (스코어 90.0) · 워커·메신저 unified-model-1 (스코어 90.0)'));
  assert.ok(rendered.includes('1. unified-model-1 · effort high · 스코어 90.0 · 100/40/50 · $2.00/1M · 접근 ChatGPT Plus'));
  assert.ok(rendered.includes('1. unified-model-1 · effort high · 스코어 90.0 · 100/40/50/75 · $2.00/1M · 접근 ChatGPT Plus'));
  assert.ok(rendered.includes('3. unified-model-3 · effort high · 스코어 84.0 · 100/40/50 · $2.00/1M · 접근 ChatGPT Plus'));
  assert.ok(!rendered.includes('가성비 1위 · 접근'));
  for (const t of ['➖', '👍']) assert.ok(rendered.includes(t), t);
  assert.ok(rendered.includes('🚪 이탈: unified-old-model (전일 8위)'));
  assert.ok(rendered.includes('## 📖 표시 안내') && rendered.includes('- 👍 파레토 최적(파레토 열): 더 싸고 더 좋은 모델이 없는 상태(단가 대비 스코어 경계선)') && !rendered.includes('↔'));
  assert.ok(rendered.indexOf('## 📖 표시 안내') < rendered.indexOf('## 출처 및 안내'));
  assert.ok(rendered.includes('## 출처 및 안내'));
  for (const t of ['출처: OpenRouter (CC-BY-4.0)',
    '출처: Artificial Analysis (라이선스 미상)', '출처: Cognition FrontierCode (라이선스 미상 · 내부 전용)',
    '출처: OpenCode Data (내부 참조 · 약관상 자동 추출 제한) (라이선스 미상)',
    '수집 실패 소스: cognition', '혼합 단가=(3×입력+출력)/4 USD/1M',
    '상세 지표는 SQLite 이력에서 확인할 수 있습니다.']) {
    assert.ok(rendered.includes(t), t);
  }
});
test('renderTop10Letter indicates all sources normal and keeps the whole compact under the 3800-char budget', () => {
  const data: Top10LetterInput = { publicationDate: '2026-10-12',
    lists: fakeLists('long-vendor-org-name/long-model-name-extra-large-v1'), failedSources: ['openrouter', 'cognition'] };
  const rendered = renderTop10Letter(data);
  assert.ok(!rendered.includes('수집 실패 소스: cognition'));
  assert.ok(rendered.includes('수집 실패 소스: openrouter'));
  assert.ok(rendered.length < 3800, `length ${rendered.length} >= 3800`);
});
test('renderTop10Letter summarizes all-new, partial-new, and no-new cohorts per list', () => {
  const mkLists = (changes: readonly ('신규' | '유지' | '▲1' | '진입')[]): RoleLists => ({
    orchestrator: { entries: changes.map((change, i) => ({ rank: i + 1, modelId: `m-${i + 1}`, indexText: '90.0',
      repEffort: 'high', blendedCostText: '$1.00/1M', plans: ['ChatGPT Plus'],
      openrouterRankText: 'OpenRouter -', isPareto: false, both: false, change })), exits: [] },
    worker: { entries: [], exits: [] } });
  const allNew = renderTop10Letter({ publicationDate: '2026-10-12', lists: mkLists(['신규', '신규']) });
  assert.ok(allNew.includes('- 변동: 🌱 오케스트레이터·리뷰어 첫 집계: 전일 기록 없음 · 워커·메신저 자료 부족'));
  const partialNew = renderTop10Letter({ publicationDate: '2026-10-12', lists: mkLists(['유지', '▲1', '진입']) });
  assert.ok(partialNew.includes('- 변동: 오케스트레이터·리뷰어 상위권 3개 중 2개 순위·진입 변동 (🆕 1개), 🚪 0개 · 워커·메신저 자료 부족'));
  const regular = renderTop10Letter({ publicationDate: '2026-10-12', lists: mkLists(['유지', '▲1', '유지']) });
  assert.ok(regular.includes('- 변동: 오케스트레이터·리뷰어 상위권 3개 중 1개 순위·진입 변동, 🚪 0개 · 워커·메신저 자료 부족'));
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
