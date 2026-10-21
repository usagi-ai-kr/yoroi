import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { compose } from '../src/composition-root.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import type { InsightRecord } from '../src/insights/record.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';
import { AA_FULL_REQUEST_SCOPE, parseAaPages } from '../src/insights/sources-aa.js';
import { parseCognitionResponse } from '../src/insights/cognition-parser.js';
import { validateInsightRecord } from '../src/insights/validation.js';

const NOW = Date.parse('2026-10-12T00:00:00Z');
const MODELS: readonly (readonly [string, number, number])[] = [['claude-opus-5-5',100,95],['glm-5-3-flash',70,99],['gpt-oss-120b',65,98],['gpt-oss-20b',60,97],['kimi-k3',55,96],['kimi-k2-7-code',50,95],['gemini-3-1-pro',94,60],['minimax-m3',93,58],['claude-sonnet-5-5',92,88],['mistral-large-4',91,56],['nemotron-3-nano',90,54],['nemotron-3-super',89,52],['nemotron-3-ultra',88,50],['space-bunny',87,48],['qwen3-7-plus',86,46],['mimo-v2-6-flash',85,44],['claude-haiku-5-5',84,80],['muse-spark-1-3-contributor',83,79],['longcat-2-5-preview-free',82,78],['step-5-preview-free',81,77],['gpt-6-1-sol',80,76],['gpt-6-luna',79,75],['gpt-5-6-terra',78,74],['gpt-5-thinking-mini',77,73],['deepseek-v4-1-flash',76,72],['deepseek-v4-pro',75,71],['gemma4',74,70],['glm-5-3',73,69],['minimax-m2-7',72,68],['kimi-k2-6',71,67]];
const aaPayload = { tier: 'free', intelligence_index_version: 4, pagination: { page: 1, page_size: 200, total_pages: 1, has_more: false },
  data: MODELS.map(([slug, intel, coding]) => ({ id: slug, slug, name: slug, release_date: null, model_creator: { id: 'c', name: 'C' },
    evaluations: { artificial_analysis_intelligence_index: intel, artificial_analysis_coding_index: 99 }, pricing: { input: 1.1, output: 4.4 }, performance: {} })) };
const aaPort: InsightSourcePort = { id: 'artificial-analysis', fetch: async () => [{ page: 1, payload: aaPayload }],
  parse: (payload, at) => parseAaPages(payload, at, {}) };
const setup = (t: TestContext) => { const dir = mkdtempSync(join(tmpdir(), 'yoroi-top10-wire-'));
  t.after(() => rmSync(dir, { recursive: true, force: true })); return { dir }; };
const previousRecord = (modelId: string, metric: string, value: number): InsightRecord => ({ source: 'artificial-analysis', modelId, metric,
  value, unit: 'score', category: 'language-models', observedAt: '2026-10-11T00:00:00Z', sourceAsOf: '2026-10-11T00:00:00Z',
  sourceUrl: 'https://artificialanalysis.ai', sourceName: 'Artificial Analysis', license: null, attributionText: 'x', method: 'official-api', schemaVersion: 'aa-v2-free' });

test('composition compact path covers the unified AA top ten, unified previous cohort and stderr failures', async (t) => {
  const { dir } = setup(t);
  const history = Object.assign(new MemoryInsightHistory(), { close() {} });
  const day = { source: 'artificial-analysis' as const, publicationDate: '2026-10-11',
    requestScope: AA_FULL_REQUEST_SCOPE, schemaVersion: 'aa-v2-free' };
  const validated = (record: InsightRecord) => { const result = validateInsightRecord(record); assert.ok(result.ok); return result.value; };
  history.saveDaily(day, { ok: true, source: 'artificial-analysis', rejectedRows: 0, records: [
    validated(previousRecord('claude-opus-5-5', 'artificial_analysis_intelligence_index', 100)),
    validated(previousRecord('claude-opus-5-5', 'artificial_analysis_coding_index', 95)),
    validated(previousRecord('gpt-6-1-sol', 'artificial_analysis_intelligence_index', 80)),
    validated(previousRecord('gpt-6-1-sol', 'artificial_analysis_coding_index', 76))] });
  const stdout: string[] = [], stderr: string[] = [];  const program = compose({ configEnv: { YOROI_DATA_DIR: dir }, dataDir: dir,
    output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }, subscribeSignals: () => () => {},
    insights: { clock: () => NOW, openHistory: () => history, createPorts: () => [aaPort] } });
  assert.equal(await program.run(['insights', 'once']), 0); const text = stdout.join('');
  assert.ok(text.length <= 3600, `length=${text.length}`);
  assert.equal((text.match(/^## (🧭 오케스트레이터·리뷰어|🛠️ 워커) Top10/gm) ?? []).length, 2);
  assert.match(text, /claude-opus-5-5 .*➖/, 'per-role previous cohort keeps the leader at rank 1');
  assert.match(text, /mistral-large-4/, 'orchestrator list must keep the mid-ranked model');
  const orch = text.slice(text.indexOf('## 🧭 오케스트레이터'), text.indexOf('## 🛠️ 워커'));
  assert.equal((orch.match(/^(▽ )?\d+\. /gm) ?? []).length, 10, 'orchestrator top10 must have 10 rows (fill rows carry ▽)');
  const work = text.slice(text.indexOf('## 🛠️ 워커'), text.indexOf('## 🆓'));
  assert.equal((work.match(/^(▽ )?\d+\. /gm) ?? []).length, 10, 'p54: AA Coding is 99 for all models, so normalized worker performance is 1 and all pass the floor');
  assert.ok(!text.includes('↔'), 'intersection mark is not shown (2026-10-13)');
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
  assert.ok(text.length <= 3600);
  assert.match(stderr.join(''), /인사이트: Artificial Analysis: /);
});
