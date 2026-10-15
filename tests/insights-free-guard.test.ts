import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { publishInsightsLetter } from '../src/composition/insights-publish.js';
import { freeSectionProblem } from '../src/insights/letter-free-guard.js';
import { FREE_EMPTY_NOTE, FREE_HEADING } from '../src/insights/letter-markdown-free.js';
import { FREE_TABLE_HEADER } from '../src/insights/letter-markdown-free-table.js';

const title = '[letter] 2026-10-16 AI 인사이트 레터';
const ok = (stdout = ''): ProcessOutput => ({ stdout, stderr: '', exitCode: 0 });
class StubRunner implements ProcessRunner {
  requests: ProcessRequest[] = [];
  constructor(private outputs: ProcessOutput[]) {}
  async run(request: ProcessRequest): Promise<ProcessOutput> { this.requests.push(request); return this.outputs.shift() ?? ok(); }
}
function harness(outputs: ProcessOutput[], body: () => Promise<string>, now = Date.UTC(2026, 9, 16)) {
  const runner = new StubRunner(outputs), stdout: string[] = [], stderr: string[] = [];
  const env = { stdout: (s: string) => stdout.push(s), stderr: (s: string) => stderr.push(s) };
  return { runner, stdout, stderr, env, run: (dryRun = false) => publishInsightsLetter({ runner, render: body, clock: () => now, ghBin: 'gh-test', ...(dryRun && { dryRun }) }, env) };
}
const validBody = `# letter\n\n${FREE_HEADING}\n\n${FREE_TABLE_HEADER}\n| step-5 | - | - | 43.7 | OpenCode Zen Free | 근거 없음 |\n`;
const invalidBody = `# letter\n\n${FREE_HEADING}\n\n${FREE_EMPTY_NOTE}\n`;

test('free section guard accepts data rows and reports each empty/free-list failure distinctly', () => {
  assert.equal(freeSectionProblem(validBody), undefined);
  assert.equal(freeSectionProblem(`# letter\n\n## 📖 표시 안내\n`), 'free section missing');
  assert.equal(freeSectionProblem(invalidBody), 'free collection failed');
  assert.equal(freeSectionProblem(`# letter\n\n${FREE_HEADING}\n\n${FREE_TABLE_HEADER}\n`), 'free table has no data rows');
});

test('publish fails before issue create when the rendered free section is empty', async () => {
  const h = harness([ok('[]')], async () => invalidBody);
  assert.equal(await h.run(), 1);
  assert.equal(h.runner.requests.length, 1);
  assert.ok(!h.runner.requests.some(r => r.args[1] === 'create'));
  assert.deepEqual(h.stderr, ['insights publish: free section invalid: free collection failed\n']);
});

test('dry-run also fails before issue create when the free section is empty', async () => {
  const h = harness([ok('[]')], async () => invalidBody);
  assert.equal(await h.run(true), 1);
  assert.equal(h.runner.requests.length, 1);
  assert.ok(!h.runner.requests.some(r => r.args[1] === 'create'));
});

test('publish dry-run continues with a non-empty free section', async () => {
  const h = harness([ok('[]'), ok(JSON.stringify([{ number: 142, title }]))], async () => validBody);
  assert.equal(await h.run(true), 0);
  assert.equal(h.runner.requests.length, 2);
  assert.ok(!h.runner.requests.some(r => r.args[1] === 'create'));
});
