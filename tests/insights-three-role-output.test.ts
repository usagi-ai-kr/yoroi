import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { letterThreeRoleConfig } from '../src/config/letter-three-role.js';
import { publishInsightsLetter } from '../src/composition/insights-publish.js';
import { hasLegacyRoleBlocks, replaceLegacyRoleBlocks, THREE_ROLE_HEADING } from '../src/insights/letter-three-role-body.js';
import { renderLetterPartsFromRecords } from '../src/insights/letter-markdown.js';
import type { LetterParts } from '../src/insights/letter-markdown.js';

class StubRunner implements ProcessRunner {
  requests: ProcessRequest[] = [];
  bodies: string[] = [];
  constructor(private readonly outputs: ProcessOutput[]) {}
  async run(request: ProcessRequest): Promise<ProcessOutput> {
    this.requests.push(request);
    const at = request.args.indexOf('--body-file');
    if (at >= 0) this.bodies.push(readFileSync(request.args[at + 1]!, 'utf8'));
    return this.outputs.shift() ?? { stdout: '', stderr: '', exitCode: 0 };
  }
}
const ok = (stdout = ''): ProcessOutput => ({ stdout, stderr: '', exitCode: 0 });
const freeComment = ['## 🆓 Free 티어', '', '| 모델 | 오케 | 워커 | AA 지수 | Free 경로 | 비고 | 작업 가능성 |',
  '| --- | --- | --- | --- | --- | --- | --- |', '| m1 | ✓ 10 | - | - | OpenCode Zen Free | - | 미검증 |'].join('\n');
const sections = { orchestrator: '## O section', reviewer: '## R section', worker: '## W section' };
const bodyOf = (runner: StubRunner): string => runner.bodies[0] ?? '';
const letterBody = (): string => {
  const parts = renderLetterPartsFromRecords({ publicationDate: '2026-10-20', records: [
    { modelId: 'm1', metric: 'total_tokens', value: 10 }] });
  return parts.body;
};

test('설정은 기본 꺼짐이고 잘못된 값은 조용히 무시하지 않는다', () => {
  assert.deepEqual(letterThreeRoleConfig({}), { enabled: false });
  assert.deepEqual(letterThreeRoleConfig({ YOROI_LETTER_THREE_ROLE: 'on' }), { enabled: true });
  assert.deepEqual(letterThreeRoleConfig({ YOROI_LETTER_THREE_ROLE: 'on', YOROI_LETTER_THREE_ROLE_DEPTH: '15' }), { enabled: true, depth: 15 });
  assert.throws(() => letterThreeRoleConfig({ YOROI_LETTER_THREE_ROLE: 'maybe' }));
  assert.throws(() => letterThreeRoleConfig({ YOROI_LETTER_THREE_ROLE: 'on', YOROI_LETTER_THREE_ROLE_DEPTH: '9' }));
});

test('기본 꺼짐: 레터 본문에 3역할 블록이 없고 기존 역할 블록이 그대로다', async () => {
  const body = letterBody();
  assert.equal(hasLegacyRoleBlocks(body), true, '기존 본문에는 2역할 블록이 있다');
  const runner = new StubRunner([ok('[]'), ok('https://github.com/usagi-ai-kr/yoroi/issues/120'), ok(), ok(), ok(), ok('[]')]);
  const out: string[] = [], err: string[] = [];
  const code = await publishInsightsLetter({ runner, render: async () => ({ body, comments: ['c1', 'c2', freeComment] as LetterParts['comments'] }),
    clock: () => Date.parse('2026-10-20T00:30:00Z') }, { stdout: s => out.push(s), stderr: s => err.push(s) });
  assert.equal(code, 0);
  const text = bodyOf(runner);
  assert.ok(!text.includes(THREE_ROLE_HEADING), '기본 꺼짐이면 3역할 블록이 없다');
  assert.equal(hasLegacyRoleBlocks(text), true, '기존 역할 블록 유지');
});

test('opt-in: 기존 2역할 블록을 대체해 3역할이 한 번만 나오고 댓글 3개 계약은 유지된다', async () => {
  const body = letterBody();
  const runner = new StubRunner([ok('[]'), ok('https://github.com/usagi-ai-kr/yoroi/issues/121'), ok(), ok(), ok(), ok('[]')]);
  const out: string[] = [], err: string[] = [];
  const code = await publishInsightsLetter({ runner, render: async () => ({ body: replaceLegacyRoleBlocks(body, sections),
    comments: ['c1', 'c2', freeComment] as LetterParts['comments'] }), clock: () => Date.parse('2026-10-20T00:30:00Z') },
    { stdout: s => out.push(s), stderr: s => err.push(s) });
  assert.equal(code, 0);
  const text = bodyOf(runner);
  assert.equal((text.match(/3역할 후보/g) ?? []).length, 1, '3역할 블록은 1회만');
  assert.equal(hasLegacyRoleBlocks(text), false, '기존 2역할 블록은 대체됨(이중출력 없음)');
  for (const marker of ['## O section', '## R section', '## W section']) assert.ok(text.includes(marker), marker);
  const comments = runner.requests.filter(r => r.args.includes('comment'));
  assert.equal(comments.length, 3, '댓글 3개 계약 유지');
  for (const c of comments) assert.ok(!c.args.includes('3역할'), '댓글 경로에는 넣지 않는다(경로 1개)');
});
