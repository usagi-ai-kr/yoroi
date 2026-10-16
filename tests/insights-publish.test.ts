import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { publishInsightsLetter } from '../src/composition/insights-publish.js';
import type { LetterParts } from '../src/insights/letter-markdown.js';

const title = '[letter] 2026-10-13 AI 인사이트 레터';
const ok = (stdout = ''): ProcessOutput => ({ stdout, stderr: '', exitCode: 0 });
const partsOf = (body = '# letter', comments: readonly [string, string, string] = ['c1', 'c2', 'c3']): LetterParts =>
  ({ body, comments });
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
function harness(outputs: ProcessOutput[], now = Date.UTC(2026, 9, 13), render: () => Promise<LetterParts> = async () => partsOf()) {
  const runner = new StubRunner(outputs), stdout: string[] = [], stderr: string[] = [];
  const env = { stdout: (s: string) => stdout.push(s), stderr: (s: string) => stderr.push(s) };
  return { runner, bodies: runner.bodies, stdout, stderr, env, run: (dryRun = false) => publishInsightsLetter({ runner, render, clock: () => now, ghBin: 'gh-test', ...(dryRun && { dryRun }) }, env) };
}

test('KST time guard skips before querying or rendering', async () => {
  const h = harness([], Date.UTC(2026, 9, 12, 23, 59)), code = await h.run();
  assert.equal(code, 0); assert.deepEqual(h.stdout, ['skip: before 09:00 KST\n']);
  assert.equal(h.runner.requests.length, 0);
});

test('existing open or closed title skips creation and body generation', async () => {
  let rendered = false;
  const h = harness([ok(JSON.stringify([{ number: 115, title }]))], Date.UTC(2026, 9, 13), async () => { rendered = true; return partsOf(); });
  assert.equal(await h.run(), 0); assert.deepEqual(h.stdout, ['skip: already published #115\n']);
  assert.equal(rendered, false); assert.equal(h.runner.requests[0]!.args.includes('--state') && h.runner.requests[0]!.args.includes('all'), true);
});

test('publishes body then 3 comments in order, then closes every older open letter', async () => {
  const h = harness([ok('[]'), ok('https://github.com/qus0in/yoroi/issues/125'), ok(), ok(), ok(),
    ok(JSON.stringify([{ number: 115, title }, { number: 125, title }, { number: 123, title: 'old' }])), ok(), ok(), ok(), ok()]);
  assert.equal(await h.run(), 0); assert.equal(h.runner.requests.length, 10);
  const create = h.runner.requests[1]!;
  assert.deepEqual(create.args.slice(0, 9), ['issue', 'create', '--repo', 'qus0in/yoroi', '--title', title, '--label', 'letter', '--body-file']);
  const comments = h.runner.requests.slice(2, 5);
  assert.deepEqual(comments.map(r => r.args.slice(0, 3)), [['issue', 'comment', '125'], ['issue', 'comment', '125'], ['issue', 'comment', '125']]);
  assert.ok(comments.every(r => r.args.includes('--body-file')), '댓글은 body-file로 단다');
  assert.deepEqual(h.bodies.slice(0, 4), ['# letter', 'c1', 'c2', 'c3'], '본문·댓글 순서 그대로 기록');
  assert.deepEqual(h.runner.requests.slice(6).map(r => r.args.slice(0, 3)), [
    ['issue', 'comment', '115'], ['issue', 'close', '115'], ['issue', 'comment', '123'], ['issue', 'close', '123']]);
  assert.ok(h.runner.requests[6]!.args.includes('후속 레터 [#125](https://github.com/qus0in/yoroi/issues/125) 발행으로 종료합니다.'));
  assert.ok(h.runner.requests.every(r => r.executable === 'gh-test' && r.timeoutMs === 30_000));
  assert.deepEqual(h.stdout, ['published #125 https://github.com/qus0in/yoroi/issues/125 2026-10-13 09:00 KST\n']);
});

test('dry-run reports close targets and comments=3 without invoking any GitHub write', async () => {
  const h = harness([ok('[]'), ok(JSON.stringify([{ number: 114, title: 'old' }]))]);
  assert.equal(await h.run(true), 0); assert.equal(h.runner.requests.length, 2);
  assert.match(h.stdout[0]!, /title="\[letter\] 2026-10-13 AI 인사이트 레터" duplicate=no close=#114 comments=3/);
  assert.ok(h.runner.requests.every(r => !['create', 'comment', 'close'].includes(r.args[1]!)));
});

test('render failure returns 1 without creating an issue', async () => {
  const h = harness([ok('[]')], Date.UTC(2026, 9, 13), async () => { throw new Error('boom'); });
  assert.equal(await h.run(), 1); assert.equal(h.runner.requests.length, 1);
  assert.deepEqual(h.stderr, ['insights publish: collection or rendering failed\n']);
});

test('GitHub errors are generic and never echo process stderr', async () => {
  const h = harness([{ stdout: '', stderr: 'gh-token must stay private', exitCode: 1 }]);
  assert.equal(await h.run(), 1); assert.deepEqual(h.stdout, []);
  assert.deepEqual(h.stderr, ['insights publish: duplicate check failed\n']);
});
