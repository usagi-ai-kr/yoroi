import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { compose } from '../src/composition-root.js';
import { SourceError } from '../src/app/usage-source.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { parseArenaRows } from '../src/insights/arena-parser.js';
import { runInsightsCommand, type InsightsCommandDeps } from '../src/ui/cli/insights-command.js';
import type { InsightLetterView } from '../src/ui/cli/insights-view.js';

const once = { kind: 'insights', operation: 'once' } as const;
const OK: InsightLetterView = { ok: true, sections: [
  { kind: 'metadata', title: 'AI 인사이트 레터', publicationDate: '2026-10-09', issuedAt: '2026-10-08T15:30:00Z' },
  { kind: 'summary', title: '요약', items: [{ text: '확인된 변화 없음', evidenceIds: [] }] },
  { kind: 'failures', title: '실패·부분 실패 소스', entries: [{ source: 'arena', reason: '수집 실패' }] },
] };
const FAILED: InsightLetterView = { ok: false, reason: '전체 소스 실패', failedSources: ['arena'] };
function capture() { const stdout: string[] = [], stderr: string[] = [];
  return { stdout, stderr, env: { stdout: (t: string) => stdout.push(t), stderr: (t: string) => stderr.push(t) } }; }
const deps = (run: InsightsCommandDeps['run']): InsightsCommandDeps => ({ run, subscribeSignals: () => () => {} });

test('plain run prints the letter to stdout, keeps partial failures on stderr and exits 0', async () => {
  const c = capture();
  assert.equal(await runInsightsCommand(once, deps(async () => ({ letter: OK, storage: 'sqlite' })), c.env), 0);
  assert.ok(c.stdout.join('').includes('[AI 인사이트 레터]'));
  assert.ok(c.stdout.join('').includes('발행일(KST): 2026-10-09'));
  assert.ok(c.stderr.join('').includes('인사이트: Arena: 수집 실패'));
});

test('--pretty switches the heading and --refresh reaches the composition run', async () => {
  const c = capture(); let seen: boolean | undefined;
  const argv = { kind: 'insights', operation: 'once', pretty: true, refresh: true } as const;
  assert.equal(await runInsightsCommand(argv, deps(async options => {
    seen = options.refresh; assert.ok(options.signal instanceof AbortSignal); return { letter: OK, storage: 'sqlite' };
  }), c.env), 0);
  assert.equal(seen, true);
  assert.ok(c.stdout.join('').includes('【요약】'));
});

test('all-source failure prints no stdout, a diagnostic on stderr and exits 1', async () => {
  const c = capture();
  assert.equal(await runInsightsCommand(once, deps(async () => ({ letter: FAILED, storage: 'sqlite' })), c.env), 1);
  assert.deepEqual(c.stdout, []);
  assert.ok(c.stderr.join('').includes('인사이트: 전체 소스 실패'));
});

test('abort cancels the pending run; a surviving letter still prints and exits 0 with a cancellation note', async () => {
  const c = capture(); let fire: (() => void) | undefined; let aborted = false;
  const run: InsightsCommandDeps['run'] = options => new Promise(resolve => {
    options.signal?.addEventListener('abort', () => { aborted = true; resolve({ letter: OK, storage: 'sqlite' }); });
    setImmediate(() => fire?.());
  });
  const program = runInsightsCommand(once, { run, subscribeSignals: handler => { fire = handler; return () => {}; } }, c.env);
  assert.equal(await program, 0);
  assert.ok(aborted);
  assert.ok(c.stdout.join('').includes('[AI 인사이트 레터]'));
  assert.ok(c.stderr.join('').includes('cancelled'));
});

test('storage=memory adds a diagnostic without changing the exit code; a throwing run exits 1 with no stdout', async () => {
  const memory = capture();
  assert.equal(await runInsightsCommand(once, deps(async () => ({ letter: OK, storage: 'memory' })), memory.env), 0);
  assert.ok(memory.stderr.join('').includes('storage unavailable'));
  assert.ok(memory.stdout.join('').includes('[요약]'));
  const thrown = capture();
  assert.equal(await runInsightsCommand(once, deps(async () => { throw new Error('synthetic'); }), thrown.env), 1);
  assert.deepEqual(thrown.stdout, []);
  assert.ok(thrown.stderr.join('').includes('insights: run failed'));
});

const rows = [0, 1, 2].map(i => ({ model_name: `m${i}`, organization: 'o', license: 'L', rating: 1500 - i,
  rating_lower: 1490, rating_upper: 1510, variance: 2, vote_count: 10 + i, rank: i + 1, category: 'overall',
  leaderboard_publish_date: '2026-10-08' }));
test('compose wires insights once to fake ports: KST publication day, same-day reuse and no network', async (t: TestContext) => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-insights-cli-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  let calls = 0; const stdout: string[] = [], stderr: string[] = [];
  const history = Object.assign(new MemoryInsightHistory(), { close() {} });
  const program = compose({ configEnv: { YOROI_DATA_DIR: dir }, dataDir: dir,
    output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }, subscribeSignals: () => () => {},
    insights: { clock: () => Date.parse('2026-10-08T15:30:00Z'), openHistory: () => history,
      createPorts: () => [{ id: 'arena', fetch: async () => { calls += 1; return rows; },
        parse: (payload, at) => parseArenaRows(payload as unknown[], at) }] } });
  assert.equal(await program.run(['insights', 'once']), 0);
  const compactOut = stdout.join('');
  assert.ok(compactOut.includes('## 🧭 오케스트레이터 Top10') && compactOut.includes('## 🛠️ 워커 Top10'), compactOut);
  assert.ok(stdout.join('').length <= 3600);
  assert.deepEqual(stderr, []);
  assert.equal(await program.run(['insights', 'once']), 0);
  assert.equal(calls, 1);
  stdout.length = 0;
  assert.equal(await program.run(['insights', 'once', '--full']), 0);
  assert.ok(stdout.join('').includes('발행일(KST): 2026-10-09'));
  stdout.length = 0;
  assert.equal(await program.run(['insights', 'once', '--markdown']), 0);
  assert.ok(stdout.join('').includes('AI 인사이트 데일리: 2026-10-09 KST'));
  assert.equal(await program.run(['insights', 'once', '--markdown', '--full']), 2);
  assert.equal(await program.run(['insights', 'once', '--json']), 2);
});
