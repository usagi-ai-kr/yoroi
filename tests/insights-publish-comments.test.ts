import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { publishInsightsLetter } from '../src/composition/insights-publish.js';
import { FREE_HEADING } from '../src/insights/letter-markdown-free.js';
import { FREE_TABLE_HEADER } from '../src/insights/letter-markdown-free-table.js';
import type { LetterParts } from '../src/insights/letter-markdown.js';

/** 1.2.0 발행 댓글 흐름: 댓글 3개 순서·Free 가드(댓글 3)·실패 시 close 금지. */
const ok = (stdout = ''): ProcessOutput => ({ stdout, stderr: '', exitCode: 0 });
const BODY = '# letter\n## 🧭 오케스트레이터 Top7\n| a |\n| --- |\n| b |\n';
const FREE_OK = `${FREE_HEADING}\n\n${FREE_TABLE_HEADER}\n| 모델 | 오케 |\n| x | ✓ |\n`;
class StubRunner implements ProcessRunner {
  requests: ProcessRequest[] = []; bodies: string[] = [];
  constructor(private outputs: ProcessOutput[]) {}
  async run(request: ProcessRequest): Promise<ProcessOutput> {
    this.requests.push(request);
    const bodyIndex = request.args.indexOf('--body-file');
    if (bodyIndex >= 0) this.bodies.push(readFileSync(request.args[bodyIndex + 1]!, 'utf8'));
    return this.outputs.shift() ?? ok();
  }
}
function harness(outputs: ProcessOutput[], render: () => Promise<LetterParts>) {
  const runner = new StubRunner(outputs), stdout: string[] = [], stderr: string[] = [];
  const env = { stdout: (s: string) => stdout.push(s), stderr: (s: string) => stderr.push(s) };
  return { runner, bodies: runner.bodies, stdout, stderr, env, run: () => publishInsightsLetter({ runner, render, clock: () => Date.UTC(2026, 9, 13), ghBin: 'gh-test' }, env) };
}
const withFree = (comments: readonly [string, string, string]): LetterParts => ({ body: BODY, comments });

test('Free 가드는 댓글 3에 적용된다 — 위반 시 이슈 생성 전에 실패한다', async () => {
  const h = harness([ok('[]')], async () => withFree(['c1', 'c2', 'no free section']));
  assert.equal(await h.run(), 1);
  assert.equal(h.runner.requests.length, 1, '중복 검사만 수행(생성 없음)');
  assert.deepEqual(h.stderr, ['insights publish: free section invalid: free section missing\n']);
});

test('댓글 3개는 이슈 생성 후 --body-file로 순서대로 달린다', async () => {
  const h = harness([ok('[]'), ok('https://github.com/qus0in/yoroi/issues/130'), ok(), ok(), ok(), ok('[]')],
    async () => withFree(['c1', 'c2', FREE_OK]));
  assert.equal(await h.run(), 0);
  const comments = h.runner.requests.filter(r => r.args[1] === 'comment');
  assert.equal(comments.length, 3);
  assert.ok(comments.every(r => r.args.includes('--body-file')));
  assert.deepEqual(h.bodies.slice(1), ['c1', 'c2', FREE_OK], '댓글 내용이 순서대로 올라간다');
  assert.deepEqual(h.stdout, ['published #130 https://github.com/qus0in/yoroi/issues/130 2026-10-13 09:00 KST\n']);
});

test('댓글 실패 시 이전 레터 close를 하지 않고 실패 코드로 끝난다', async () => {
  const h = harness([ok('[]'), ok('https://github.com/qus0in/yoroi/issues/131'), ok(), { stdout: '', stderr: 'nope', exitCode: 1 }],
    async () => ({ body: '# letter', comments: ['c1', 'c2', 'c3'] }));
  assert.equal(await h.run(), 1);
  assert.equal(h.runner.requests.length, 4, '중복 검사·생성·댓글 2회에서 끝난다');
  assert.ok(h.stderr[0]!.includes('comment 2 failed (issue #131 left open)'), h.stderr[0]!);
  assert.ok(!h.runner.requests.some(r => r.args[1] === 'close'), '실패 시 close 없음');
  assert.ok(!h.stdout.some(line => line.startsWith('published')), '성공 출력 없음');
});
