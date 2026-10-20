import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { publishInsightsLetter } from '../src/composition/insights-publish.js';
import { recoverMissingLetterComments } from '../src/composition/insights-publish-recovery.js';
import type { LetterParts } from '../src/insights/letter-markdown.js';

class MockRunner implements ProcessRunner {
  public commented: string[] = [];
  constructor(private readonly handler: (req: ProcessRequest) => ProcessOutput) {}
  async run(req: ProcessRequest): Promise<ProcessOutput> { return this.handler(req); }
}
const filesIn = (dir: string, bodies: readonly string[]): string[] => bodies.map((body, i) => {
  const f = join(dir, `c${i + 1}.md`); writeFileSync(f, body); return f; });
const withTemp = async (run: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-recover-'));
  try { await run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};

for (const [name, created] of [
  ['other repo', 'https://github.com/other/repo/issues/9\n'],
  ['non-github output', 'created #9 (no url)\n'],
  ['multi output other-first', 'see https://github.com/other/repo/issues/9 then https://github.com/qus0in/yoroi/issues/193\n'],
] as const) {
  test(`F1: create output ${name} fails closed without posting`, async () => {
    const commented: string[] = [];
    const runner = new MockRunner(req => {
      if (req.args.includes('list')) return { stdout: '[]', stderr: '', exitCode: 0 };
      if (req.args.includes('create')) return { stdout: created, stderr: '', exitCode: 0 };
      if (req.args.includes('comment')) { commented.push('x'); return { stdout: 'ok', stderr: '', exitCode: 0 }; }
      return { stdout: '', stderr: '', exitCode: 0 };
    });
    const err: string[] = [];
    const code = await publishInsightsLetter({
      runner, render: async () => ({ body: '# letter', comments: ['c1', 'c2', 'c3'] }) as LetterParts,
      clock: () => new Date('2026-10-20T09:30:00+09:00').getTime(),
    }, { stdout: () => undefined, stderr: (s: string) => err.push(s) });
    assert.equal(code, 1);
    assert.deepEqual(commented, []);
    assert.ok(err.some(e => e.includes('unexpected repo URL') || e.includes('issue creation failed')));
  });
}

test('F2: body mismatch refuses recovery with issue left open', async () => {
  await withTemp(async dir => {
    const files = filesIn(dir, ['new-c1', 'new-c2', 'new-c3']);
    let posts = 0;
    const runner = new MockRunner(req => {
      if (req.args.includes('body')) return { stdout: JSON.stringify({ body: 'old body' }), stderr: '', exitCode: 0 };
      if (req.args.includes('comment')) { posts++; return { stdout: 'ok', stderr: '', exitCode: 0 }; }
      return { stdout: JSON.stringify({ comments: [] }), stderr: '', exitCode: 0 };
    });
    const r = await recoverMissingLetterComments(runner, 'gh', 192, '[letter] t', files, 'qus0in/yoroi', undefined, 'new body');
    assert.equal(r.status, 'failed');
    assert.equal(posts, 0);
  });
});

test('F2: unrelated existing comments do not skip missing ones, no duplicates', async () => {
  await withTemp(async dir => {
    const files = filesIn(dir, ['c1', 'c2', 'c3']);
    const posted: string[] = [];
    const runner = new MockRunner(req => {
      if (req.args.includes('body')) return { stdout: JSON.stringify({ body: 'B' }), stderr: '', exitCode: 0 };
      if (req.args.includes('comments')) return { stdout: JSON.stringify({ comments: [{ body: 'human note' }, { body: 'c1' }] }), stderr: '', exitCode: 0 };
      if (req.args.includes('comment')) { posted.push(req.args[req.args.indexOf('--body-file') + 1]!); return { stdout: 'ok', stderr: '', exitCode: 0 }; }
      return { stdout: '', stderr: '', exitCode: 0 };
    });
    const r = await recoverMissingLetterComments(runner, 'gh', 192, '[letter] t', files, 'qus0in/yoroi', undefined, 'B');
    assert.equal(r.status, 'recovered');
    assert.equal(r.recoveredCount, 2);
    assert.deepEqual(posted.map(f => f.endsWith('c2.md') ? 'c2' : 'c3').sort(), ['c2', 'c3']);
  });
});
