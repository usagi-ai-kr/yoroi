import assert from 'node:assert';
import test from 'node:test';
import { runThreeRolePipeline } from '../src/insights/letter-three-role-pipeline.js';

test('1. default-off returns no output when enabled is false or omitted', () => {
  const r1 = runThreeRolePipeline({ orchestrator: [{ modelId: 'o1' }] });
  assert.strictEqual(r1.enabled, false);
  assert.strictEqual(r1.markdown, undefined);
  assert.strictEqual(r1.selection, undefined);
  const r2 = runThreeRolePipeline({ orchestrator: [{ modelId: 'o1' }], options: { enabled: false } });
  assert.strictEqual(r2.enabled, false);
});

test('2. reviewer weights applied only to reviewer; orchestrator & worker unchanged', () => {
  const o = [{ modelId: 'o1', performance: 100, speed: 100, price: 100 }];
  const r = [{ modelId: 'r1', performance: 0.80, speed: 0.90, price: 0.70 }];
  const w = [{ modelId: 'w1', performance: 100, speed: 100, price: 100 }];
  const res = runThreeRolePipeline({ orchestrator: o, reviewer: r, worker: w, options: { enabled: true } });
  assert.strictEqual(res.enabled, true);
  // 0.80 * 0.50 + 0.90 * 0.20 + 0.70 * 0.30 = 0.79 → 0~100 통일 79.0
  assert.strictEqual(res.selection?.reviewer.top7[0]?.score, 79.0);
  assert.strictEqual(res.selection?.orchestrator.top7[0]?.score, undefined);
  assert.strictEqual(res.selection?.worker.top7[0]?.score, undefined);
});

test('3. accepts pre-scored candidates or custom score callback', () => {
  const r = [{ modelId: 'r-pre', score: 95 }, { modelId: 'r-cb', performance: 50 }];
  const res = runThreeRolePipeline({
    reviewer: r,
    options: {
      enabled: true,
      reviewerPolicy: { scoreCallback: (c) => (c.modelId === 'r-cb' ? 88 : undefined) },
    },
  });
  assert.strictEqual(res.selection?.reviewer.top7[0]?.score, 95);
  assert.strictEqual(res.selection?.reviewer.top7[1]?.score, 88);
});

test('4. missing evidence does not fabricate scores ("-" in table)', () => {
  const r = [{ modelId: 'r-partial', performance: 80 }];
  const res = runThreeRolePipeline({ reviewer: r, options: { enabled: true } });
  assert.strictEqual(res.selection?.reviewer.top7[0]?.score, undefined);
  assert.ok(res.markdown?.includes('| 1 |  | r-partial | - | - |'));
});

test('5. MECE closed duplicate exclusion across orchestrator and reviewer', () => {
  const o = [{ modelId: 'shared-c', weightOpen: false }, { modelId: 'o-only', weightOpen: false }];
  const r = [{ modelId: 'shared-c', weightOpen: false }, { modelId: 'r-only', weightOpen: false }];
  const res = runThreeRolePipeline({ orchestrator: o, reviewer: r, options: { enabled: true } });
  assert.deepStrictEqual(res.selection?.orchestrator.top7.map(x => x.modelId), ['shared-c', 'o-only']);
  assert.deepStrictEqual(res.selection?.reviewer.top7.map(x => x.modelId), ['r-only']);
});

test('6. MECE open-weight duplicate allowed across orchestrator and reviewer', () => {
  const o = [{ modelId: 'shared-o', weightOpen: true }];
  const r = [{ modelId: 'shared-o', weightOpen: true }];
  const res = runThreeRolePipeline({ orchestrator: o, reviewer: r, options: { enabled: true } });
  assert.deepStrictEqual(res.selection?.orchestrator.top7.map(x => x.modelId), ['shared-o']);
  assert.deepStrictEqual(res.selection?.reviewer.top7.map(x => x.modelId), ['shared-o']);
});

test('7. worker independence from orchestrator and reviewer', () => {
  const o = [{ modelId: 'shared', weightOpen: false }];
  const r = [{ modelId: 'shared', weightOpen: false }];
  const w = [{ modelId: 'shared', weightOpen: false }];
  const m = [{ modelId: 'shared', weightOpen: false }];
  const res = runThreeRolePipeline({ orchestrator: o, reviewer: r, worker: w, messenger: m, options: { enabled: true } });
  assert.strictEqual(res.selection?.orchestrator.top7[0]?.modelId, 'shared');
  assert.strictEqual(res.selection?.reviewer.top7.length, 0);
  assert.strictEqual(res.selection?.worker.top7[0]?.modelId, 'shared');
  assert.strictEqual(res.selection?.messenger?.top7[0]?.modelId, 'shared', '메신저는 MECE 밖 독립(워커와 겹침 허용)');
  assert.deepStrictEqual(res.messengerPool?.map(x => x.modelId), ['shared'], '컷 전 전체 eligible 보존');
});

test('8. renderer integration renders 3 role sections with depth and legend', () => {
  const res = runThreeRolePipeline({
    orchestrator: [{ modelId: 'o1', score: 90 }],
    reviewer: [{ modelId: 'r1', score: 85 }],
    worker: [{ modelId: 'w1', score: 80 }],
    options: { enabled: true, depth: 7, publicationDate: '2026-10-20' },
  });
  const md = res.markdown!;
  assert.ok(md.includes('# 3역할 리포트 (2026-10-20)'));
  assert.ok(md.includes('## 🧭 오케스트레이터 Top7'));
  assert.ok(md.includes('## 🔍 리뷰어 Top7'));
  assert.ok(md.includes('## 🛠️ 워커 Top7'));
  assert.ok(md.includes('## 📖 표시 안내'));
});

test('9. deterministic repeat across multiple runs', () => {
  const input = {
    orchestrator: [{ modelId: 'o1' }],
    reviewer: [{ modelId: 'r1', performance: 80, speed: 70, price: 90 }],
    options: { enabled: true },
  };
  const r1 = runThreeRolePipeline(input);
  const r2 = runThreeRolePipeline(input);
  assert.strictEqual(r1.markdown, r2.markdown);
  assert.deepStrictEqual(r1.selection, r2.selection);
});
