import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTop10Markdown } from '../src/insights/letter-markdown.js';
import type { RoleEntry, RoleLists } from '../src/insights/letter-markdown.js';
import { PLAN_CATALOG } from '../src/insights/plan-catalog.js';

const entry = (modelId: string, plans: readonly string[], extra: Partial<RoleEntry> = {}): RoleEntry =>
  ({ rank: 1, modelId, indexText: '80.0', repEffort: 'high', blendedCostText: '$1.00', costEffRankText: '-',
    scoreText: '50.0', plans, change: '신규', isPareto: false, both: false, ...extra });
const lists = (o: readonly RoleEntry[], w: readonly RoleEntry[]): RoleLists =>
  ({ orchestrator: { entries: o, exits: [] }, worker: { entries: w, exits: [] } });
const render = (l: RoleLists): string => renderTop10Markdown({ publicationDate: '2026-10-13', lists: l });

const ORCH = [entry('gpt-6-1-sol', ['ChatGPT Plus']),
  entry('claude-haiku-5-5', ['Claude Pro', 'OpenCode Go Plus'], { rank: 2, both: true, isPareto: true })];
const WORKER = [entry('claude-haiku-5-5', ['Claude Pro', 'OpenCode Go Plus'], { rank: 1, both: true }),
  entry('glm-5-3', ['Ollama Cloud Pro'], { rank: 2 }), entry('gemini-3-1-pro', ['Antigravity'], { rank: 3 })];

test('접근 요금제 표는 워커 Top10 뒤 Free 섹션 앞에 놓인다', () => {
  const md = render(lists(ORCH, WORKER));
  assert.ok(md.indexOf('## 🛠️ 워커 Top10') < md.indexOf('## 접근 요금제'));
  assert.ok(md.indexOf('## 접근 요금제') < md.indexOf('## 🆓 Free 티어'));
});

test('Top10 unique 모델을 첫 등장 순서로 한 번만 나열하고 모델 셀은 modelId만 쓴다', () => {
  const md = render(lists(ORCH, WORKER));
  const section = md.slice(md.indexOf('## 접근 요금제'), md.indexOf('## 🆓 Free 티어'));
  const rows = section.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| 모델') && !l.startsWith('| ---'));
  assert.deepEqual(rows.map(r => r.split('|')[1]!.trim()), ['gpt-6-1-sol', 'claude-haiku-5-5', 'glm-5-3', 'gemini-3-1-pro']);
  assert.ok(!section.includes('↔') && !section.includes('⭐'), '기호 없이 modelId만');
});

test('열은 plans의 barePlan 합집합을 PLAN_CATALOG 순서로 나열하고 ☑/☐로 접근을 표시한다', () => {
  const md = render(lists(ORCH, WORKER));
  const used = PLAN_CATALOG.map(p => p.planName)
    .filter(n => ['ChatGPT Plus', 'Claude Pro', 'Ollama Cloud Pro', 'OpenCode Go Plus', 'Antigravity'].includes(n));
  assert.ok(md.includes(`| 모델 | ${used.join(' | ')} |`), used.join(' | '));
  assert.ok(md.includes(`| --- | ${used.map(() => '---').join(' | ')} |`));
  assert.ok(md.includes('| gpt-6-1-sol | ☑ | ☐ | ☐ | ☐ | ☐ |'));
  assert.ok(md.includes('| claude-haiku-5-5 | ☐ | ☑ | ☐ | ☑ | ☐ |'));
  assert.ok(md.includes('| glm-5-3 | ☐ | ☐ | ☑ | ☐ | ☐ |'));
  assert.ok(md.includes('| gemini-3-1-pro | ☐ | ☐ | ☐ | ☐ | ☑ |'));
});

test('괄호 주석은 벗겨지고 중복 플랜 라벨은 한 열로 합쳐진다', () => {
  const md = render(lists([entry('gpt-6-1-sol', ['OpenCode Go Plus(440회/5h)', 'OpenCode Go Plus'])], []));
  assert.ok(md.includes('| 모델 | OpenCode Go Plus |'));
  assert.ok(md.includes('| gpt-6-1-sol | ☑ |'));
});

test('기존 Top10 표에서는 접근 요금제 열이 사라진다', () => {
  const md = render(lists(ORCH, WORKER));
  assert.ok(md.includes('| 순위 | 모델 | 추천 effort | 스코어 | 지수 | 혼합 단가 | 변동 |'));
  assert.ok(md.includes('| 1 | gpt-6-1-sol | high | 50.0 | 80.0 | $1.00 | 🌱 |'));
  assert.ok(!md.includes('| 순위 | 모델 | 추천 effort | 스코어 | 지수 | 혼합 단가 | 접근 요금제 | 변동 |'));
});

test('행이 없으면 접근 요금제 표를 생략한다', () => {
  const md = render(lists([], []));
  assert.ok(!md.includes('## 접근 요금제') && !md.includes('☑'), md);
});
