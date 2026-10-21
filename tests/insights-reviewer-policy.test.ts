import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { threeRoleInputFromEnv } from '../src/composition/insights-cli.js';
import { compose } from '../src/composition-root.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import {
  applyReviewerPolicy,
  computeReviewerScore,
  REVIEWER_POLICY_CONFIRMED,
  REVIEWER_POLICY_STATUS,
} from '../src/insights/letter-reviewer-policy.js';

test('1. reviewer policy is confirmed and uses 50/20/30 defaults', () => {
  assert.equal(REVIEWER_POLICY_STATUS, 'confirmed');
  assert.equal(REVIEWER_POLICY_CONFIRMED, true);
  const cand = { modelId: 'r1', performance: 0.80, speed: 0.90, price: 0.70 };
  // 0.80*0.5 + 0.90*0.2 + 0.70*0.3 = 0.79 → 0~100 통일 79.0
  assert.equal(computeReviewerScore(cand), 79.0);
  assert.equal(computeReviewerScore({ modelId: 'r2', performance: 0.815, speed: 0.90, price: 0.70 }), 79.8);
});

test('2. weight override changes score and alters ranking order', () => {
  const cSpeed = { modelId: 'speedy', performance: 80, speed: 100, price: 0 };
  const cCheap = { modelId: 'thrifty', performance: 80, speed: 0, price: 100 };
  // Default 50/20/30: speedy gets 40+20=60, thrifty gets 40+30=70 -> thrifty wins
  const def = applyReviewerPolicy([cSpeed, cCheap]);
  assert.deepEqual(def.map(c => c.modelId), ['thrifty', 'speedy']);
  // Override 50/40/10: speedy gets 40+40=80, thrifty gets 40+10=50 -> speedy wins
  const over = applyReviewerPolicy([cSpeed, cCheap], { weights: { performance: 0.50, speed: 0.40, price: 0.10 } });
  assert.deepEqual(over.map(c => c.modelId), ['speedy', 'thrifty']);
});

test('3. evidence recalculates reviewer score and fixes candidate score precedence bug', () => {
  // Candidate has prior orchestrator score: 99
  const cand = { modelId: 'r1', score: 99, performance: 0.80, speed: 0.90, price: 0.70 };
  const res = applyReviewerPolicy([cand]);
  // Reviewer weights recompute to 79.0 rather than silently keeping 99
  assert.equal(res[0]?.score, 79.0);
});

test('4. pre-existing score preserved when evidence is missing without fabrication', () => {
  const cand = { modelId: 'r-pre', score: 85 };
  assert.equal(computeReviewerScore(cand), 85);
  const candNoScore = { modelId: 'r-none', performance: 80 }; // missing speed and price
  assert.equal(computeReviewerScore(candNoScore), undefined);
});

test('5. custom callback takes precedence over evidence', () => {
  const cand = { modelId: 'r1', performance: 80, speed: 90, price: 70 };
  const score = computeReviewerScore(cand, undefined, (c) => 99.5);
  assert.equal(score, 99.5);
});

test('6. orchestrator and worker candidates/policies untouched', () => {
  const orchCand = { modelId: 'o1', score: 95, performance: 10, speed: 10, price: 10 };
  // applyReviewerPolicy is only applied to reviewer; orchCand remains as-is
  assert.equal(orchCand.score, 95);
});

const rows = [{ model_name: 'm0', rating: 1500, category: 'overall', leaderboard_publish_date: '2026-10-08' }];
const parseStub = (payload: unknown, at: string) => (payload as typeof rows).map((r, index) => ({ ok: true as const, index, warnings: [], records: [
  { source: 'openrouter' as const, modelId: r.model_name, metric: 'total_tokens', value: r.rating, unit: 'tokens', category: r.category, observedAt: at, sourceAsOf: r.leaderboard_publish_date, metadata: { date: r.leaderboard_publish_date }, sourceUrl: 'https://example.test/data', sourceName: 'Synthetic', license: null, attributionText: 'x', method: 'synthetic', schemaVersion: 'openrouter-rankings-v1' }] }));

test('7. env on enables threeRole through the production compose path', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-reviewer-env-')); try {
    const run = async (configEnv: Record<string, string | undefined>): Promise<string> => {
      const out: string[] = [];
      const history = Object.assign(new MemoryInsightHistory(), { close() {} });
      const program = compose({ configEnv, dataDir: dir, output: { stdout: (s: string) => out.push(s), stderr: () => {} },
        subscribeSignals: () => () => {}, insights: { clock: () => Date.parse('2026-10-08T15:30:00Z'),
          openHistory: () => history, createPorts: () => [{ id: 'openrouter', fetch: async () => rows, parse: parseStub }] } });
      assert.equal(await program.run(['insights', 'once']), 0);
      return out.join('\n');
    };
    const on = await run({ YOROI_LETTER_THREE_ROLE: 'on' });
    assert.ok(!on.includes('3역할 후보'), '발행 본문에는 내부용 머리글을 남기지 않는다');
    for (const heading of ['🧭 오케스트레이터 Top7', '🔍 리뷰어 Top7', '🛠️ 워커 Top7']) {
      assert.equal(on.split(heading).length - 1, 1, `${heading} 는 1회`); }
    assert.ok(!(await run({})).includes('🔍 리뷰어 Top7'), '기본 off는 3역할 섹션이 없고 기존 2역할 블록 유지');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('9. env opt-in maps to threeRole input, off maps to empty', () => {
  assert.deepEqual(threeRoleInputFromEnv({ YOROI_LETTER_THREE_ROLE: 'on' }), { threeRole: true });
  assert.deepEqual(threeRoleInputFromEnv({}), {});
});
