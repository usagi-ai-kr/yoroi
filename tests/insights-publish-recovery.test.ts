import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { extractIssueUrlAndNumber } from '../src/composition/insights-publish-target.js';
import { recoverMissingLetterComments } from '../src/composition/insights-publish-recovery.js';
import { publishInsightsLetter } from '../src/composition/insights-publish.js';
import type { LetterParts } from '../src/insights/letter-markdown.js';

class MockRunner implements ProcessRunner {
  constructor(private readonly handler: (req: ProcessRequest) => ProcessOutput) {}
  async run(req: ProcessRequest): Promise<ProcessOutput> { return this.handler(req); }
}

test('extractIssueUrlAndNumber: handles canonical and redirected repo URLs', () => {
  const c1 = extractIssueUrlAndNumber('https://github.com/qus0in/yoroi/issues/192\n');
  assert.equal(c1?.number, 192);
  assert.equal(c1?.repo, 'qus0in/yoroi');

  const c2 = extractIssueUrlAndNumber('https://github.com/usagi-ai-kr/yoroi/issues/192\n');
  assert.equal(c2?.number, 192); assert.equal(c2?.repo, 'usagi-ai-kr/yoroi');
  assert.equal(extractIssueUrlAndNumber('not a url'), undefined);
});

test('recoverMissingLetterComments: protects non-letter issues', async () => {
  const runner = new MockRunner(req => {
    if (req.args.includes('comment')) return { stdout: 'https://github.com/qus0in/yoroi/issues/192#issuecomment-1', stderr: '', exitCode: 0 };
    return { stdout: '', stderr: '', exitCode: 0 };
  });
  const rProtected = await recoverMissingLetterComments(runner, 'gh', 192, 'memo: today task', ['c1.md', 'c2.md', 'c3.md']);
  assert.equal(rProtected.status, 'not_a_letter');
});

test('publishInsightsLetter: recovers partial issue without extra CLI options', async () => {
  const postedComments: string[] = [];
  const runner = new MockRunner(req => {
    const args = req.args;
    if (args.includes('list') && (args.includes('--search') || args.includes('open'))) {
      return { stdout: JSON.stringify([{ number: 192, title: '[letter] 2026-10-20 AI 인사이트 레터' }]), stderr: '', exitCode: 0 };
    }
    if (args.includes('view') && args.includes('192')) {
      if (args.includes('body')) return { stdout: JSON.stringify({ body: '# letter' }), stderr: '', exitCode: 0 };
      return { stdout: JSON.stringify({ comments: [] }), stderr: '', exitCode: 0 };
    }
    if (args.includes('comment') && args.includes('192')) {
      postedComments.push(args[args.indexOf('--body-file') + 1]!);
      return { stdout: 'ok', stderr: '', exitCode: 0 };
    }
    return { stdout: '', stderr: '', exitCode: 0 };
  });

  const out: string[] = [], err: string[] = [];
  const env = { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) };
  const parts: LetterParts = { body: '# letter', comments: ['comm1', 'comm2', 'comm3'] };

  const code = await publishInsightsLetter({ runner, render: async () => parts,
    clock: () => new Date('2026-10-20T09:30:00+09:00').getTime() }, env);
  assert.equal(code, 0);
  assert.equal(postedComments.length, 3);
  assert.ok(out.some(line => line.includes('recovered #192')));
});

test('publishInsightsLetter: supports usagi-ai-kr canonical URL on creation', async () => {
  const runner = new MockRunner(req => {
    const args = req.args;
    if (args.includes('list') && args.includes('--search')) return { stdout: '[]', stderr: '', exitCode: 0 };
    if (args.includes('create')) return { stdout: 'https://github.com/usagi-ai-kr/yoroi/issues/193\n', stderr: '', exitCode: 0 };
    if (args.includes('comment')) return { stdout: 'ok', stderr: '', exitCode: 0 };
    if (args.includes('list') && args.includes('open')) return { stdout: JSON.stringify([{ number: 193, title: 't' }]), stderr: '', exitCode: 0 };
    return { stdout: '', stderr: '', exitCode: 0 };
  });

  const out: string[] = [], err: string[] = [];
  const env = { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) };
  const parts: LetterParts = { body: '# letter', comments: ['c1', 'c2', 'c3'] };

  const code = await publishInsightsLetter({ runner, render: async () => parts,
    clock: () => new Date('2026-10-20T09:30:00+09:00').getTime() }, env);
  assert.equal(code, 0);
  assert.ok(out.some(line => line.includes('published #193')));
});
