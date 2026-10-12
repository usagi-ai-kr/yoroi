import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { compose } from '../src/composition-root.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import type { InsightRecord } from '../src/insights/record.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';
import { parseAaPages } from '../src/insights/sources-aa.js';
import { parseCognitionResponse } from '../src/insights/cognition-parser.js';
import { parseArenaRows } from '../src/insights/arena-parser.js';
import { validateInsightRecord } from '../src/insights/validation.js';

const NOW = Date.parse('2026-10-12T00:00:00Z');
const aaPayload = { tier: 'free', intelligence_index_version: 4, pagination: { page: 1, page_size: 200, total_pages: 1, has_more: false },
  data: Array.from({ length: 30 }, (_, i) => ({ id: `m-${100 - i}`, slug: `m-${100 - i}`, name: `Model ${100 - i}`, release_date: null,
    model_creator: { id: 'c', name: 'C' }, evaluations: { artificial_analysis_intelligence_index: 60 - i, artificial_analysis_coding_index: 90 - i }, pricing: {}, performance: {} })) };
const aaPort: InsightSourcePort = { id: 'artificial-analysis', fetch: async () => [{ page: 1, payload: aaPayload }],
  parse: (payload, at) => parseAaPages(payload, at, {}) };
const setup = (t: TestContext) => { const dir = mkdtempSync(join(tmpdir(), 'yoroi-top10-wire-'));
  t.after(() => rmSync(dir, { recursive: true, force: true })); return { dir }; };
const previousRecord = (modelId: string, metric: string, value: number): InsightRecord => ({ source: 'artificial-analysis', modelId, metric,
  value, unit: 'score', category: 'language-models', observedAt: '2026-10-11T00:00:00Z', sourceAsOf: '2026-10-11T00:00:00Z',
  sourceUrl: 'https://artificialanalysis.ai', sourceName: 'Artificial Analysis', license: null, attributionText: 'x', method: 'official-api', schemaVersion: 'aa-v2-free' });

test('composition compact path covers both AA top tens, metric-split previous cohorts and stderr failures', async (t) => {
  const { dir } = setup(t);
  const history = Object.assign(new MemoryInsightHistory(), { close() {} });
  const day = { source: 'artificial-analysis' as const, publicationDate: '2026-10-11',
    requestScope: 'aa-v2:free:language-models:coding-intel-top50', schemaVersion: 'aa-v2-free' };
  const validated = (record: InsightRecord) => { const result = validateInsightRecord(record); assert.ok(result.ok); return result.value; };
  history.saveDaily(day, { ok: true, source: 'artificial-analysis', rejectedRows: 0, records: [
    validated(previousRecord('m-100', 'artificial_analysis_intelligence_index', 59)),
    validated(previousRecord('m-100', 'artificial_analysis_coding_index', 89)),
    validated(previousRecord('m-99', 'artificial_analysis_intelligence_index', 58))] });
  const stdout: string[] = [], stderr: string[] = [];  const program = compose({ configEnv: { YOROI_DATA_DIR: dir }, dataDir: dir,
    output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }, subscribeSignals: () => () => {},
    insights: { clock: () => NOW, openHistory: () => history, createPorts: () => [aaPort] } });
  assert.equal(await program.run(['insights', 'once']), 0); const text = stdout.join('');
  assert.ok(text.length <= 3000, `length=${text.length}`);
  assert.equal((text.match(/^## 오케스트레이터 Top10/m) ?? []).length, 1);
  assert.equal((text.match(/^## 워커 Top10/m) ?? []).length, 1);
  assert.match(text, /m-100/);
  assert.match(text, /m-91/, '10th model of both lists must be present (not truncated at 20 evidence rows)');
  const orchestrator = text.slice(text.indexOf('## 오케스트레이터'), text.indexOf('## 워커'));
  const worker = text.slice(text.indexOf('## 워커'), text.indexOf('## 출처'));
  assert.equal((orchestrator.match(/^\d+\. /gm) ?? []).length, 10, 'orchestrator top10 must have 10 rows');
  assert.equal((worker.match(/^\d+\. /gm) ?? []).length, 10, 'worker top10 must have 10 rows');
  assert.match(orchestrator, /m-99 \([^)]*\) (유지|▲\d+|▼\d+)/, 'intelligence previous cohort applies');
  assert.match(worker, /m-99 \([^)]*\) 진입/, 'coding must not inherit intelligence previous ranks (new within its own cohort)');
  assert.doesNotMatch(text, /인사이트: /);
  stdout.length = 0; stderr.length = 0;
  assert.equal(await program.run(['insights', 'once', '--full']), 0);
  assert.match(stdout.join(''), /\[AI 인사이트 레터\]/);
  stdout.length = 0; stderr.length = 0;
  const failing = { id: 'cognition' as const, fetch: async () => { throw new Error('synthetic'); }, parse: () => [] };
  const failingProgram = compose({ configEnv: { YOROI_DATA_DIR: dir }, dataDir: dir,
    output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }, subscribeSignals: () => () => {},
    insights: { clock: () => NOW, openHistory: () => Object.assign(new MemoryInsightHistory(), { close() {} }),
      createPorts: () => [aaPort, failing] } });
  assert.equal(await failingProgram.run(['insights', 'once']), 0);
  assert.match(stderr.join(''), /인사이트: Cognition: /);
});

test('Cognition-only success still renders the compact letter with 자료 부족 and failure footer', async (t) => {
  const { dir } = setup(t);
  const cognitionPayload = { v1_1: { models: ['M'], subsets: { main: 100 }, data: { M: { high: { main: { correct: 0.5, cost: 1 } } } } } };
  const cognitionPort: InsightSourcePort = { id: 'cognition', fetch: async () => cognitionPayload,
    parse: (payload, at) => parseCognitionResponse(payload, at) };
  const failingAa: InsightSourcePort = { id: 'artificial-analysis', fetch: async () => { throw new Error('synthetic'); }, parse: () => [] };
  const stdout: string[] = [], stderr: string[] = [];  const program = compose({ configEnv: { YOROI_DATA_DIR: dir }, dataDir: dir,
    output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }, subscribeSignals: () => () => {},
    insights: { clock: () => NOW, openHistory: () => Object.assign(new MemoryInsightHistory(), { close() {} }),
      createPorts: () => [cognitionPort, failingAa] } });
  assert.equal(await program.run(['insights', 'once']), 0); const text = stdout.join('');
  assert.equal((text.match(/자료 부족/g) ?? []).length >= 2, true, text);
  assert.ok(text.length <= 3000);
  assert.match(stderr.join(''), /인사이트: Artificial Analysis: /);
});

test('composition passes Arena official ranks through the production-shaped metric:rank path', async (t) => {
  const { dir } = setup(t);
  const model = (id: string, intel: number, coding: number) => ({ id, slug: id, name: id, release_date: null,
    model_creator: { id: 'c', name: 'C' }, evaluations: { artificial_analysis_intelligence_index: intel, artificial_analysis_coding_index: coding }, pricing: {}, performance: {} });
  const aa = { tier: 'free', intelligence_index_version: 4, pagination: { page: 1, page_size: 50, total_pages: 1, has_more: false },
    data: [model('A', 60, 70), model('B', 50, 60)] };
  const arenaRow = (name: string, rating: number, rank: number) => ({ model_name: name, organization: 'o', license: 'L', rating,
    rating_lower: rating - 10, rating_upper: rating + 10, variance: 2, vote_count: 10, rank, category: 'overall', leaderboard_publish_date: '2026-10-11' });
  const aaPort: InsightSourcePort = { id: 'artificial-analysis', fetch: async () => [{ page: 1, payload: aa }], parse: (payload, at) => parseAaPages(payload, at, {}) };
  const arenaPort: InsightSourcePort = { id: 'arena', fetch: async () => [arenaRow('A', 1500, 2), arenaRow('B', 1400, 1)],
    parse: (payload, at) => parseArenaRows(payload as unknown[], at) };
  const stdout: string[] = [], stderr: string[] = [];  const program = compose({ configEnv: { YOROI_DATA_DIR: dir }, dataDir: dir,
    output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }, subscribeSignals: () => () => {},
    insights: { clock: () => NOW, openHistory: () => Object.assign(new MemoryInsightHistory(), { close() {} }),
      createPorts: () => [aaPort, arenaPort] } });
  assert.equal(await program.run(['insights', 'once']), 0); const text = stdout.join('');
  assert.match(text, /A \(60\.0[^)]*Arena 2위\)/, text); assert.match(text, /B \(50\.0[^)]*Arena 1위\)/, text);
});
