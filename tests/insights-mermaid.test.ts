import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeMermaidLabel, mermaidFence, renderTeamMermaid } from '../src/insights/letter-mermaid.js';
import type { TeamCombination } from '../src/insights/letter-team-combinations.js';

/** #253: Mermaid 렌더 안전성 — 고정 노드 ID · 라벨 이스케이프 · 코드 펜스 주입 방지. */
const slot = (role: 'orchestrator' | 'reviewer' | 'worker', modelId: string, score?: number) =>
  ({ role, modelId, ...(score !== undefined && { score }) });
const combination = (slots: TeamCombination['slots'], extra: Partial<TeamCombination> = {}): TeamCombination =>
  ({ key: 'best-1+1+3', label: '가장 최선', slots, totalScore: 0, feasible: true, ...extra });

test('노드 ID 는 고정(O/R/W1..)이고 라벨에 모델명만 담는다', () => {
  const md = renderTeamMermaid(combination([slot('orchestrator', 'o-a', 90), slot('reviewer', 'r-a', 80),
    slot('worker', 'w-a', 70), slot('worker', 'w-b', 60), slot('worker', 'w-c', 50)]));
  assert.ok(md.startsWith('```mermaid\n'), 'mermaid 펜스');
  assert.ok(md.trimEnd().endsWith('```'), '펜스 닫기');
  assert.ok(md.includes('  O["오케스트레이터 · o-a"]'), 'O 노드');
  assert.ok(md.includes('  R["리뷰어 · r-a"]'), 'R 노드');
  assert.ok(md.includes('  W1["워커 1 · w-a"]') && md.includes('  W3["워커 3 · w-c"]'), 'W1..W3 고정 ID');
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
