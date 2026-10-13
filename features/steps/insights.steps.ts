import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { After, Before, Then, When } from '@cucumber/cucumber';
import { compose } from '../../src/composition-root.js';
import { SourceError } from '../../src/app/usage-source.js';
import { MemoryInsightHistory } from '../../src/insights/history-memory.js';

const CLOCK = Date.parse('2026-10-08T15:30:00Z'); // 2026-10-09 00:30 KST
const rows = [0, 1, 2].map(i => ({ model_name: `m${i}`, organization: 'o', license: 'L', rating: 1500 - i,
  rating_lower: 1490, rating_upper: 1510, variance: 2, vote_count: 10 + i, rank: i + 1, category: 'overall',
  leaderboard_publish_date: '2026-10-08' }));
/** BDD 전용 날짜형(OpenRouter 형태) 최소 파서(주입 포트 배선 확인용). */
const parseDatedStub = (payload: unknown, at: string) => (payload as typeof rows).map((r, index) => ({ ok: true as const, index, warnings: [],
  records: [{ source: 'openrouter' as const, modelId: r.model_name, metric: 'total_tokens', value: r.rating, unit: 'tokens', category: r.category,
    observedAt: at, sourceAsOf: r.leaderboard_publish_date, metadata: { date: r.leaderboard_publish_date }, sourceUrl: 'https://example.test/data',
    sourceName: 'Synthetic Source', license: null, attributionText: 'x', method: 'synthetic', schemaVersion: 'openrouter-rankings-v1' }] }));
const keep = () => Object.assign(new MemoryInsightHistory(), { close() {} });
const world: { dir: string; out: string[]; err: string[]; code: number; calls: number; failing: boolean;
  history?: ReturnType<typeof keep> } = { dir: '', out: [], err: [], code: -1, calls: 0, failing: false };
Before(() => { world.dir = mkdtempSync(join(tmpdir(), 'yoroi-insights-bdd-'));
  Object.assign(world, { out: [], err: [], code: -1, calls: 0, failing: false, history: undefined }); });
After(() => { rmSync(world.dir, { recursive: true, force: true }); });

async function run(argv: string[]): Promise<void> {
  const history = world.history ?? (world.history = keep());
  world.code = await compose({
    configEnv: { YOROI_DATA_DIR: world.dir }, dataDir: world.dir,
    output: { stdout: line => world.out.push(line), stderr: line => world.err.push(line) },
    subscribeSignals: () => () => {},
    insights: { clock: () => CLOCK, openHistory: () => history, createPorts: () => [{
      id: 'openrouter' as const,
      fetch: async () => { world.calls += 1; if (world.failing) throw new SourceError('network'); return rows; },
      parse: parseDatedStub,
    }] },
  }).run(argv);
}
When('I run insights once with a synthetic dated source', () => run(['insights', 'once']));
When('I run insights once --full with a synthetic dated source', () => run(['insights', 'once', '--full']));
When('I run insights once --markdown with a synthetic dated source', () => run(['insights', 'once', '--markdown']));
When('I run insights once twice on the same KST day', async () => { await run(['insights', 'once']); await run(['insights', 'once']); });
When('I run insights once with a failing source', () => { world.failing = true; return run(['insights', 'once']); });
When('I run insights once --json', () => run(['insights', 'once', '--json']));
When('I open insights help', () => run(['insights', '--help']));
Then('the insights exit code is {int}', (expected: number) => assert.equal(world.code, expected));
Then('the insights stdout contains {string}', (text: string) => assert.ok(world.out.join('\n').includes(text), world.out.join('\n')));
Then('the insights stdout is empty', () => assert.deepEqual(world.out, []));
Then('the insights stderr is empty', () => assert.deepEqual(world.err, []));
Then('the insights stderr contains {string}', (text: string) => assert.ok(world.err.join('\n').includes(text), world.err.join('\n')));
Then('the insights fetch count is {int}', (expected: number) => assert.equal(world.calls, expected));
Then('the insights stdout has exactly {int} line containing {string}', (count: number, text: string) => {
  assert.equal(world.out.length, count); assert.ok(world.out.join('\n').includes(text), world.out.join('\n'));
});
