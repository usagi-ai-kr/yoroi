import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeMermaidLabel, mermaidFence, renderTeamMermaid, runnersUpCaption } from '../src/insights/letter-mermaid.js';
import { buildTeamCombinations } from '../src/insights/letter-team-combinations.js';
import type { TeamCombination } from '../src/insights/letter-team-combinations.js';

/** #253: Mermaid 렌더 안전성 — 고정 노드 ID · 라벨 이스케이프 · 코드 펜스 주입 방지. */
const slot = (role: 'orchestrator' | 'reviewer' | 'worker', modelId: string, score?: number) =>
  ({ role, modelId, ...(score !== undefined && { score }) });
const combination = (slots: TeamCombination['slots'], extra: Partial<TeamCombination> = {}): TeamCombination =>
  ({ key: 'best-1+1+3', label: '가장 최선', slots, totalScore: 0, feasible: true, runnersUp: {}, unmeasured: 0, ...extra });

test('노드 ID 는 고정(O/R/W1..)이고 라벨에 모델명만 담는다', () => {
  const md = renderTeamMermaid(combination([slot('orchestrator', 'o-a', 90), slot('reviewer', 'r-a', 80),
    slot('worker', 'w-a', 70), slot('worker', 'w-b', 60), slot('worker', 'w-c', 50)]));
  assert.ok(md.startsWith('```mermaid\n'), 'mermaid 펜스');
  assert.ok(md.trimEnd().endsWith('```'), '펜스 닫기');
  assert.ok(md.includes('  O["🧭 오케스트레이터 · o-a"]'), 'O 노드');
  assert.ok(md.includes('  R["🔍 리뷰어 · r-a"]'), 'R 노드');
  assert.ok(md.includes('  W1["🛠️ 워커 1 · w-a"]') && md.includes('  W3["🛠️ 워커 3 · w-c"]'), 'W1..W3 고정 ID');
  assert.ok(md.includes('O --> R') && md.includes('O --> W1'), '오케 → 나머지 간선');
  assert.ok(!md.includes('effort'), 'effort 미표시(#253 요구 3)');
});

test('라벨 특수문자·코드 펜스 주입을 막는다', () => {
  const evil = 'm"` ```mermaid\n  X["inject"]';
  const md = renderTeamMermaid(combination([slot('orchestrator', evil, 90), slot('worker', 'w\"a', 10)]));
  const fences = md.split('```').length - 1;
  assert.equal(fences, 2, '펜스는 정확히 2개(주변만) — 라벨이 펜스를 깨지 않음');
  assert.equal(escapeMermaidLabel(evil), 'm mermaid X inject', '따옴표·대괄호·백틱 제거');
  assert.equal(escapeMermaidLabel('a`b"c'), 'a b c');
});

test('구성 불가는 사유를 표시하고 가짜 모델을 넣지 않는다', () => {
  const md = renderTeamMermaid(combination([], { feasible: false, reason: '워커 3개 부족' }));
  assert.ok(md.includes('조합 구성 불가'), md);
  assert.ok(md.includes('워커 3개 부족'), md);
  assert.ok(!/\bO\[/.test(md), '모델 노드 없음');
});

test('mermaidFence 는 본문을 한 펜스로 감싼다', () => {
  const fenced = mermaidFence(['flowchart TB', '  A["x"]']);
  assert.deepEqual(fenced.split('\n'), ['```mermaid', 'flowchart TB', '  A["x"]', '```']);
});

const cand = (modelId: string, score?: number, free?: boolean) =>
  ({ modelId, ...(score !== undefined && { score }), ...(free === true && { free: true }) });

test('차선은 조합 밖 최고 후보이며 1+2 에는 리뷰어 차선이 없다', () => {
  const top = { orchestrator: [cand('o1', 90), cand('o2', 80)], reviewer: [cand('r1', 85)], worker: [cand('w1', 70), cand('w2', 60), cand('w3', 50)] };
  const [best, small] = [buildTeamCombinations({ top15: top })[0]!, buildTeamCombinations({ top15: top })[1]!];
  assert.equal(runnersUpCaption(best.runnersUp), '**🥈 차선**\n- 🧭 오케스트레이터: o2\n- 🔍 리뷰어: -\n- 🛠️ 워커: -', '1+1+3 은 3역할 차선·후보 없으면 -');
  assert.equal(runnersUpCaption(small.runnersUp), '**🥈 차선**\n- 🧭 오케스트레이터: o2\n- 🛠️ 워커: w3', '1+2 는 리뷰어 차선 없음');
  assert.ok(!runnersUpCaption(small.runnersUp).includes('리뷰어'), '1+2 캡션에 리뷰어 없음');
  assert.ok(!runnersUpCaption(best.runnersUp).includes('```'), '캡션은 fence 밖 문자열');
});

test('Free 후보 노드·캡션에 Free 표시, 총점·unmeasured 분리', () => {
  const top = { orchestrator: [cand('o1', 90)], reviewer: [cand('r1', 80)], worker: [cand('w1', 70)] };
  const free = [cand('beam-x', undefined, true), cand('beam-y', undefined, true), cand('beam-z', undefined, true)];
  const combo = buildTeamCombinations({ top15: top, freeWorkerFallback: free })[0]!;
  assert.equal(combo.feasible, true);
  assert.deepEqual([combo.totalScore, combo.unmeasured], [90 + 80 + 70, 2], '측정만 합산·미측정 수 노출');
  assert.ok(renderTeamMermaid(combo).includes('beam-x 🆓'), '노드 Free 표시');
  assert.ok(runnersUpCaption(combo.runnersUp).includes('beam-z 🆓'), '캡션 Free 표시');
  assert.ok(combo.slots.every(s => s.score !== undefined || s.free === true), '점수 없음은 free 표시뿐');
});

test('구성 불가 조합의 차선 캡션은 - 이다(가짜 후보 없음)', () => {
  assert.equal(runnersUpCaption({}), '-');
  const top = { orchestrator: [cand('o1', 90)], reviewer: [cand('r1', 80)], worker: [cand('w1', 70)] };
  const combos = buildTeamCombinations({ top15: top, unionPool: { o: [], r: [], w: [cand('w1', 70)] } });
  assert.equal(combos[2]!.feasible, false);
  assert.equal(runnersUpCaption(combos[2]!.runnersUp), '-', '구성 불가는 -');
});

test('차선 캡션 모델 id를 이스케이프한다', () => {
  assert.equal(runnersUpCaption({ orchestrator: { modelId: 'm`x\ny' } }), '**🥈 차선**\n- 🧭 오케스트레이터: m x y');
});

test('free 1+2 도 리뷰어 차선이 없다', () => {
  const top = { orchestrator: [cand('o1', 90), cand('o2', 80)], reviewer: [cand('r1', 85)], worker: [cand('w1', 70), cand('w2', 60)] };
  const combos = buildTeamCombinations({ top15: top, unionPool: { o: [cand('o1', 90), cand('o2', 80)],
    r: [cand('r1', 85), cand('r2', 75)], w: [cand('w1', 70), cand('w2', 60)] } });
  assert.equal(combos[3]!.feasible, true, '오픈 1+2 구성 가능');
  assert.ok(!runnersUpCaption(combos[3]!.runnersUp).includes('리뷰어'), 'free 1+2 에도 리뷰어 차선 없음');
});

test('#260: Mermaid 라벨·차선 캡션은 표시 정규화된 모델 id를 쓴다', () => {
  const combo = { key: 'best-1+1+3' as const, label: 'x', slots: [{ role: 'orchestrator' as const, modelId: 'deepseek-v4-1-flash-free', score: 90 }],
    totalScore: 0, feasible: true, unmeasured: 0, runnersUp: { roles: ['orchestrator' as const], orchestrator: { modelId: 'beam-free' } } };
  assert.ok(renderTeamMermaid(combo).includes('O["🧭 오케스트레이터 · deepseek-v4-1-flash"]'), '노드 라벨 정규화');
  assert.equal(runnersUpCaption(combo.runnersUp), '**🥈 차선**\n- 🧭 오케스트레이터: beam', '캡션 정규화');
});
