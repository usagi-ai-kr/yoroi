import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runInsights } from '../src/composition/insights.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { renderLetterPartsFromRecords } from '../src/insights/letter-markdown.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

/** #194 D: composition 이 publish/once 로 넘기는 Free 리뷰어 근거(3역할 활성 때만). */
const M = 'artificial_analysis_intelligence_index';
const SPEED = 'median_output_tokens_per_second';
const PRICE_IN = 'price_1m_input_tokens', PRICE_OUT = 'price_1m_output_tokens';
const records: Top10RecordInput[] = [
  { modelId: 'minimax-m3-1-flash', metric: M, value: 90 }, { modelId: 'minimax-m3-1-flash', metric: SPEED, value: 120 },
  { modelId: 'minimax-m3-1-flash', metric: PRICE_IN, value: 1 }, { modelId: 'minimax-m3-1-flash', metric: PRICE_OUT, value: 2 },
  { modelId: 'other-model', metric: M, value: 40 }, { modelId: 'other-model', metric: SPEED, value: 90 },
  { modelId: 'other-model', metric: PRICE_IN, value: 1 }, { modelId: 'other-model', metric: PRICE_OUT, value: 2 }];
const parseStub = (payload: unknown) => (payload as Top10RecordInput[]).map((r, i) => ({ ok: true as const, index: i,
  records: [{ source: 'artificial-analysis' as const, modelId: r.modelId, metric: r.metric ?? M, value: r.value ?? 0,
    unit: 'score', category: 'overall', observedAt: '2026-10-20T00:00:00.000Z', sourceAsOf: '2026-10-19', sourceUrl: 'https://a.test',
    sourceName: 'AA', license: null, attributionText: 'AA', method: 'official-dataset', schemaVersion: 'aa-v2-free' }], warnings: [] }));
/** 공식 Free 페이지 stub: Free 행(가격 Free) 1건. */
const pageHtml = '<table><tbody><tr><td>MiniMax M3.1 Flash Free</td><td>minimax-m3.1-flash-free</td><td>Free</td><td>Free</td></tr></tbody></table>';

const runOnce = async (threeRole: boolean): Promise<Awaited<ReturnType<typeof runInsights>>> => {
  const dir = mkdtempSync(join(tmpdir(), 'free-reviewer-publish-'));
  try {
    const history = Object.assign(new MemoryInsightHistory(), { close() {} });
    return await runInsights({ env: {}, ...(threeRole && { threeRole: true }), dataEnv: { YOROI_DATA_DIR: dir }, clock: () => Date.parse('2026-10-20T15:30:00Z'),
      openHistory: () => history,
      createPorts: () => [{ id: 'artificial-analysis', fetch: async () => records, parse: parseStub }],
      http: { request: async () => ({ status: 200, headers: {}, body: pageHtml }) },
      processRunner: { run: async () => ({ stdout: 'opencode/minimax-m3.1-flash-free', stderr: '', exitCode: 0 }) } });
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('3역할 활성 시 Free 표에 리뷰어 근거가 실려 내려온다', async () => {
  const out = await runOnce(true);
  const freeReviewer = (out.top10 as { freeReviewer?: readonly { modelId: string; score: string }[] } | undefined)?.freeReviewer;
  assert.ok(freeReviewer && freeReviewer.length > 0, '리뷰어 근거가 top10 에 실린다');
  const parts = renderLetterPartsFromRecords({ publicationDate: '2026-10-20', ...(out.top10 as object) } as never);
  assert.ok(parts.comments[2]!.includes('| 오케 | 리뷰어 | 워커 |'), 'Free 3역할 표 머리');
});

test('3역할 비활성이면 근거 없이 기존 2역할 출력이 유지된다', async () => {
  const out = await runOnce(false);
  const freeReviewer = (out.top10 as { freeReviewer?: readonly unknown[] } | undefined)?.freeReviewer;
  assert.equal(freeReviewer, undefined, '비활성이면 근거 없음');
});

test('3역할 활성 시 Free 표에 메신저 근거가 실려 4역할 표가 된다', async () => {
  const out = await runOnce(true);
  const freeMessenger = (out.top10 as { freeMessenger?: readonly { modelId: string; score: string }[] } | undefined)?.freeMessenger;
  assert.ok(freeMessenger && freeMessenger.length > 0, '메신저 근거가 top10 에 실린다');
  const parts = renderLetterPartsFromRecords({ publicationDate: '2026-10-20', ...(out.top10 as object) } as never);
  assert.ok(parts.comments[2]!.includes('| 오케 | 리뷰어 | 워커 | 메신저 |'), 'Free 4역할 표 머리');
  assert.ok(parts.comments[2]!.includes(freeMessenger[0]!.score), '메신저 점수 표시(생성 없음)');
});

test('3역할 비활성이면 메신저 근거 없이 기존 2역할 출력이 유지된다', async () => {
  const out = await runOnce(false);
  assert.equal((out.top10 as { freeMessenger?: readonly unknown[] } | undefined)?.freeMessenger, undefined);
  const parts = renderLetterPartsFromRecords({ publicationDate: '2026-10-20', ...(out.top10 as object) } as never);
  assert.ok(parts.comments[2]!.includes('| 모델 | 오케 | 워커 |'), '2역할 머리 유지');
  assert.ok(!parts.comments[2]!.includes('| 메신저 |'), '메신저 열 없음');
});
