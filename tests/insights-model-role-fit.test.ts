import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadModelRoleFit, roleFitBaseId, roleFitMark, roleFitNote, roleFitLegend } from '../src/insights/model-role-fit.js';
import { renderThreeRoleSection } from '../src/insights/letter-three-role-render.js';

/** #194: usagi 정성 역할 적합성(점수 아님) 표기 계약. */
const FIT_FILE = { source: { repository: 'usagi-ai-kr/usagi', path: 'docs/wiki/Model-Operations.md', commit: 'a43d31a',
    checkedOn: '2026-10-20', url: 'https://github.com/usagi-ai-kr/usagi/blob/a43d31a/docs/wiki/Model-Operations.md' },
  models: { 'glm-5-3-flash': { reviewer: { fit: '◎', note: 'CI·릴리스 변경을 독립적으로 보는 리뷰에 강함.' }, worker: { fit: '◎', note: '코드·테스트 위임에 지시 이행이 성실함.' } } } };
/** #230: Free 목록 id('…-free')로 들어온 워커·오케 항목에도 같은 정성 각주가 붙어야 한다. */
const FREE_FIT_FILE = { models: {
  'deepseek-v4-1-flash': { orchestrator: { fit: '◎', note: '상황표 정리.' }, worker: { fit: '△', note: '구현 진입 경향.' } },
  'glm-5-3-flash': { orchestrator: { fit: '○', note: '단위 조정.' }, worker: { fit: '◎', note: '코드·테스트 확인 성실.' } },
  'mimo-v2-6-flash': { orchestrator: { fit: '×', note: '세션 불안정.' }, worker: { fit: '△', note: '문서 작성.' } },
  'minimax-m3-1-flash': { orchestrator: { fit: '×', note: '오래 이어지는 작업 어려움.' }, worker: { fit: '○', note: '한글 문서 적합.' } } } };
const scoreCell = (t: string) => (t.split('\n').find(l => l.startsWith('| 1 |')) ?? '').split('|')[4]?.trim() ?? '';
const hasNote = (t: string) => t.split('\n').some(l => l.startsWith('> '));
const section = (modelId: string, score: number, effort = 'default', role: 'worker' | 'reviewer' = 'worker') => renderThreeRoleSection(role, [{ modelId, rank: 1, score, effort }], 7);

test('알려진 모델·역할은 usagi 정성 노트를 준다', () => {
  const note = roleFitNote('glm-5-3-flash', 'reviewer', FIT_FILE)!;
  assert.ok(note.startsWith('usagi ◎ · ') && note.includes('독립적으로 보는 리뷰'), note); });

test('역할이 다르면 다른 노트, 다른 역할은 표시되지 않는다', () => {
  const worker = roleFitNote('glm-5-3-flash', 'worker', FIT_FILE)!;
  assert.ok(worker.includes('지시 이행'), worker);
  assert.notEqual(worker, roleFitNote('glm-5-3-flash', 'reviewer', FIT_FILE));
  assert.equal(roleFitNote('glm-5-3-flash', 'orchestrator', FIT_FILE), undefined, '관찰 없는 역할은 undefined'); });

test('unknown 모델·effort 접미사·설정 부재는 안전하게 미표기', () => {
  assert.equal(roleFitNote('unknown-model', 'reviewer', FIT_FILE), undefined);
  assert.equal(roleFitNote('glm-5-3-flash-xhigh', 'reviewer', FIT_FILE)?.startsWith('usagi ◎'), true, 'effort 접미사도 base 로 매칭');
  assert.equal(roleFitBaseId('glm-5-3-flash-xhigh'), 'glm-5-3-flash');
  assert.equal(loadModelRoleFit(join(tmpdir(), 'no-such-role-fit.json')), undefined);
});

test('설정 파일이 깨져도 예외 없이 미표기', () => {
  const dir = mkdtempSync(join(tmpdir(), 'role-fit-')); try {
    const path = join(dir, 'broken.json'); writeFileSync(path, '{broken');
    assert.equal(loadModelRoleFit(path), undefined, '깨진 설정은 미표기');
    assert.equal(roleFitNote('glm-5-3-flash', 'reviewer', { models: {} }), undefined, '빈 목록이면 미표기');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('범례는 점수 아님을 명시하고 출처 URL 을 남긴다', () => {
  const legend = roleFitLegend(FIT_FILE);
  assert.ok((legend[0] ?? '').includes('2026-10-20') && (legend[0] ?? '').includes('점수 아님'), legend[0] ?? '');
  assert.ok(legend.some(l => l.includes('a43d31a')), legend.join(' | ')); });

test('Free 접미 id 를 base 로 정규화한다', () => {
  const cases: readonly (readonly [string, string])[] = [['deepseek-v4-1-flash-free', 'deepseek-v4-1-flash'],
    ['glm-5-3-flash-free', 'glm-5-3-flash'], ['mimo-v2-6-flash-free', 'mimo-v2-6-flash'], ['minimax-m3-1-flash-free', 'minimax-m3-1-flash'],
    ['deepseek-v4-1-flash-free-high', 'deepseek-v4-1-flash'], ['glm-5-3-flash', 'glm-5-3-flash']];
  for (const [from, to] of cases) assert.equal(roleFitBaseId(from), to, from);
});

test('Free id 로 온 워커·오케 항목에 정성 각주가 붙는다', () => {
  for (const id of ['deepseek-v4-1-flash-free', 'glm-5-3-flash-free', 'mimo-v2-6-flash-free', 'minimax-m3-1-flash-free']) {
    const worker = roleFitNote(id, 'worker', FREE_FIT_FILE), orchestrator = roleFitNote(id, 'orchestrator', FREE_FIT_FILE);
    assert.ok(worker?.startsWith('usagi '), `${id} 워커 각주: ${worker ?? '없음'}`);
    assert.ok(orchestrator?.startsWith('usagi '), `${id} 오케 각주: ${orchestrator ?? '없음'}`); } });

test('미확인 Free id 에는 각주를 만들지 않는다', () => {
  assert.equal(roleFitNote('unknown-model-free', 'worker', FREE_FIT_FILE), undefined);
  assert.equal(roleFitNote('deepseek-v4-1-flash-free', 'reviewer', FREE_FIT_FILE), undefined, '관찰 없는 역할');
  assert.ok(!hasNote(section('unknown-model-free', 50)), '미확인 id 각주 없음');
});

test('렌더: Free id 항목에도 표 아래 각주가 표시되고 점수 칸은 불변', () => {
  const out = section('deepseek-v4-1-flash-free', 57.6, 'max');
  assert.ok(out.split('\n').some(l => l.startsWith('> deepseek-v4-1-flash: usagi ')), 'Free id 각주 표시');
  assert.equal(scoreCell(out), '57.6', '점수 칸 불변');
});

/** #231: glm-5-3 과 glm-5-3-flash 는 별개 모델이다(공식 Free 목록·AA id·#229 실측).
 *  따라서 병합하지 않는다 — glm-5-3 행에는 각주가 없고 glm-5-3-flash 계열만 각주를 갖는다. */
test('glm-5-3 은 glm-5-3-flash 의 약칭이 아니라 별개 모델로 각주가 비어 있다', () => {
  assert.equal(roleFitNote('glm-5-3', 'worker'), undefined, '관찰 없는 glm-5-3 은 각주 없음');
  assert.ok(roleFitNote('glm-5-3-flash', 'worker')?.startsWith('usagi '), 'glm-5-3-flash 각주 유지');
  assert.ok(roleFitNote('glm-5-3-flash-free', 'worker')?.startsWith('usagi '), 'Free id 도 동일 각주');
  assert.ok(!hasNote(section('glm-5-3', 53.2, 'max')), 'glm-5-3 각주 없음');
});

test('#232: roleFitMark 은 정성 표식만 돌려주고 관찰 없음은 undefined', () => {
  assert.equal(roleFitMark('glm-5-3-flash', 'worker', FIT_FILE), '◎', '역할별 표식 그대로');
  assert.equal(roleFitMark('glm-5-3-flash-free', 'worker', FIT_FILE), '◎', 'Free id 정규화 동일');
  assert.equal(roleFitMark('unknown-model', 'worker', FIT_FILE), undefined, '관찰 없음 undefined');
  assert.equal(roleFitMark('glm-5-3-flash', 'orchestrator', FIT_FILE), undefined, '관찰 없는 역할은 undefined');
});

test('렌더 전용: 정성 노트는 점수·순위 칸에 영향을 주지 않는다', () => {
  const withNote = section('glm-5-3-flash', 73.2, 'xhigh', 'reviewer');
  const withoutNote = section('other-model', 73.2, 'xhigh', 'reviewer');
  assert.equal(scoreCell(withNote), scoreCell(withoutNote), '점수 칸 동일');
  assert.ok(withNote.split('\n').some(l => l.startsWith('> glm-5-3-flash: usagi')), '알려진 모델은 표 아래 주석');
  assert.ok(!hasNote(withoutNote), '모르는 모델은 주석 없음');
});
