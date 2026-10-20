import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadModelRoleFit, roleFitBaseId, roleFitNote, roleFitLegend } from '../src/insights/model-role-fit.js';
import { renderThreeRoleSection } from '../src/insights/letter-three-role-render.js';

/** #194: usagi 정성 역할 적합성(점수 아님) 표기 계약. */
const FIT_FILE = { source: { repository: 'usagi-ai-kr/usagi', path: 'docs/wiki/Model-Operations.md', commit: 'a43d31a',
    checkedOn: '2026-10-20', url: 'https://github.com/usagi-ai-kr/usagi/blob/a43d31a/docs/wiki/Model-Operations.md' },
  models: { 'glm-5-3-flash': { reviewer: { fit: '◎', note: 'CI·릴리스 변경을 독립적으로 보는 리뷰에 강함.' },
    worker: { fit: '◎', note: '코드·테스트 위임에 지시 이행이 성실함.' } } } };

test('알려진 모델·역할은 usagi 정성 노트를 준다', () => {
  const note = roleFitNote('glm-5-3-flash', 'reviewer', FIT_FILE)!;
  assert.ok(note.startsWith('usagi ◎ · '), note);
  assert.ok(note.includes('독립적으로 보는 리뷰'), note);
});

test('역할이 다르면 다른 노트, 다른 역할은 표시되지 않는다', () => {
  const worker = roleFitNote('glm-5-3-flash', 'worker', FIT_FILE)!;
  assert.ok(worker.includes('지시 이행'), worker);
  assert.notEqual(worker, roleFitNote('glm-5-3-flash', 'reviewer', FIT_FILE));
  assert.equal(roleFitNote('glm-5-3-flash', 'orchestrator', FIT_FILE), undefined, '관찰 없는 역할은 undefined');
});

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
  assert.ok(legend.some(l => l.includes('a43d31a')), legend.join(' | '));
});

test('렌더 전용: 정성 노트는 점수·순위 칸에 영향을 주지 않는다', () => {
  const entry = { modelId: 'glm-5-3-flash', rank: 1, score: 73.2, effort: 'xhigh' };
  const withNote = renderThreeRoleSection('reviewer', [entry], 7);
  const withoutNote = renderThreeRoleSection('reviewer', [{ ...entry, modelId: 'other-model' }], 7);
  const scoreCell = (t: string) => (t.split('\n').find(l => l.startsWith('| 1 |')) ?? '').split('|')[4]?.trim() ?? '';
  assert.equal(scoreCell(withNote), scoreCell(withoutNote), '점수 칸 동일');
  assert.ok(withNote.split('\n').some(l => l.startsWith('> glm-5-3-flash: usagi')), '알려진 모델은 표 아래 주석');
  assert.ok(!withoutNote.split('\n').some(l => l.startsWith('> ')), '모르는 모델은 주석 없음');
});
