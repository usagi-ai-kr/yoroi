import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTop10Letter, type Top10LetterInput } from '../src/insights/letter-top10-render.js';
import type { Top10Result } from '../src/insights/letter-top10-rank.js';

function fakeResult(prefix: string): Top10Result {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    rank: i + 1, modelId: `${prefix}-model-${i + 1}`, indexValue: (95.0 - i * 2.5).toFixed(1),
    arenaRankText: i < 5 ? `Arena ${i + 1}위` : 'Arena -',
    openrouterRankText: i < 3 ? `OpenRouter ${i + 1}위` : 'OpenRouter -',
    change: i === 0 ? '유지' as const : i === 1 ? '▲1' as const : '신규' as const,
  }));
  return { entries, exits: [{ modelId: `${prefix}-old-model`, previousRank: 8, text: `이탈: ${prefix}-old-model(전일 8위)` }] };
}

test('renderTop10Letter renders full section structure and footer attributions', () => {
  const data: Top10LetterInput = {
    publicationDate: '2026-10-12', orchestrator: fakeResult('orch'), worker: fakeResult('worker'),
    failedSources: ['cognition'],
  };
  const rendered = renderTop10Letter(data);
  assert.ok(rendered.includes('[AI 인사이트 데일리: 2026-10-12 KST (내부 전용)]'));
  assert.ok(rendered.includes('## 오케스트레이터 Top10 (판단·계획 / Intelligence Index)'));
  assert.ok(rendered.includes('1. orch-model-1 (95.0, Arena 1위, OpenRouter 1위) 유지'));
  assert.ok(rendered.includes('• 이탈: orch-old-model (전일 8위)'));
  assert.ok(rendered.includes('## 워커 Top10 (실행·코딩 / Coding Index)'));
  assert.ok(rendered.includes('1. worker-model-1 (95.0, Arena 1위, OpenRouter 1위) 유지'));
  assert.ok(rendered.includes('• 이탈: worker-old-model (전일 8위)'));
  assert.ok(rendered.includes('## 출처 및 안내'));
  assert.ok(rendered.includes('출처: lmarena-ai LMArena Leaderboard Dataset (CC-BY-4.0)'));
  assert.ok(rendered.includes('출처: OpenRouter (CC-BY-4.0)'));
  assert.ok(rendered.includes('출처: Artificial Analysis (라이선스 미확인)'));
  assert.ok(rendered.includes('출처: Cognition FrontierCode (라이선스 미확인 · 내부 전용)'));
  assert.ok(rendered.includes('수집 실패 소스: cognition'));
  assert.ok(rendered.includes('상세 지표는 SQLite 이력에서 확인할 수 있습니다.'));
});

test('renderTop10Letter indicates all sources normal when failedSources is empty or absent', () => {
  const data: Top10LetterInput = {
    publicationDate: '2026-10-12',
    orchestrator: fakeResult('orch'),
    worker: fakeResult('worker'),
  };
  const rendered = renderTop10Letter(data);
  assert.ok(rendered.includes('전 소스 정상 수집'));
  assert.ok(!rendered.includes('수집 실패 소스'));
});

test('renderTop10Letter length is well under 3,000 characters', () => {
  const data: Top10LetterInput = {
    publicationDate: '2026-10-12',
    orchestrator: fakeResult('long-vendor-org-name/long-model-name-extra-large-v1'),
    worker: fakeResult('long-vendor-org-name/long-worker-model-name-coding-v2'),
    failedSources: ['openrouter', 'cognition'],
  };
  const rendered = renderTop10Letter(data);
  assert.ok(rendered.length < 3000, `length ${rendered.length} >= 3000`);
});

test('renderTop10Letter summarize handles all-new, partial-new, and no-new cohorts', () => {
  const mkResult = (changes: readonly ('신규' | '유지' | '▲1')[]) => ({
    entries: changes.map((change, i) => ({
      rank: i + 1,
      modelId: `m-${i + 1}`,
      indexValue: '90.0',
      arenaRankText: 'Arena -',
      openrouterRankText: 'OpenRouter -',
      change,
    })),
    exits: [],
  });

  const allNew = renderTop10Letter({
    publicationDate: '2026-10-12',
    orchestrator: mkResult(['신규', '신규']),
    worker: mkResult(['신규']),
  });
  assert.ok(allNew.includes('- 변동: 첫 집계: 전일 비교 기록 없음'));

  const partialNew = renderTop10Letter({
    publicationDate: '2026-10-12',
    orchestrator: mkResult(['유지', '▲1']),
    worker: mkResult(['신규']),
  });
  assert.ok(partialNew.includes('- 변동: 상위권 3개 중 1개 순위·진입 변동 (신규 1개), 이탈 0개'));

  const regular = renderTop10Letter({
    publicationDate: '2026-10-12',
    orchestrator: mkResult(['유지', '▲1']),
    worker: mkResult(['유지']),
  });
  assert.ok(regular.includes('- 변동: 상위권 3개 중 1개 순위·진입 변동, 이탈 0개'));
});
