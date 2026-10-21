import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { letterThreeRoleConfig } from '../src/config/letter-three-role.js';
import { publishInsightsLetter } from '../src/composition/insights-publish.js';
import { hasLegacyRoleBlocks, replaceLegacyRoleBlocks, THREE_ROLE_HEADING } from '../src/insights/letter-three-role-body.js';
import { buildThreeRole } from '../src/composition/insights-three-role.js';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import type { InsightRunResult } from '../src/insights/run-once.js';
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
const freeComment = ['## 🆓 Free 티어', '', '| 모델 | 오케 | 워커 | AA 지수 | Zen | Go | 비고 |', '| --- | --- | --- | --- | --- | --- | --- |', '| m1 | ✓ 10 | - | - | ✓ | - | - |'].join('\n');
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
  assert.throws(() => letterThreeRoleConfig({ YOROI_LETTER_THREE_ROLE: 'maybe' })); assert.throws(() => letterThreeRoleConfig({ YOROI_LETTER_THREE_ROLE: 'on', YOROI_LETTER_THREE_ROLE_DEPTH: '9' }));
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
  assert.equal(hasLegacyRoleBlocks(text), true, '기존 역할 블록 유지');});

test('opt-in: 기존 2역할 블록을 대체해 3역할이 한 번만 나오고 댓글 3개 계약은 유지된다', async () => {
  const body = letterBody();
  const runner = new StubRunner([ok('[]'), ok('https://github.com/usagi-ai-kr/yoroi/issues/121'), ok(), ok(), ok(), ok('[]')]);
  const out: string[] = [], err: string[] = [];
  const code = await publishInsightsLetter({ runner, render: async () => ({ body: replaceLegacyRoleBlocks(body, sections),
    comments: ['c1', 'c2', freeComment] as LetterParts['comments'] }), clock: () => Date.parse('2026-10-20T00:30:00Z') },
    { stdout: s => out.push(s), stderr: s => err.push(s) });
  assert.equal(code, 0);
  const text = bodyOf(runner);
  assert.ok(!text.includes('3역할 후보'), '발행 본문에는 내부용 3역할 머리글을 남기지 않는다');
  assert.equal((text.match(/## O section/g) ?? []).length, 1, '3역할 섹션은 1회만'); assert.equal(hasLegacyRoleBlocks(text), false, '이중출력 없음');
  for (const marker of ['## O section', '## R section', '## W section']) assert.ok(text.includes(marker), marker);
  const comments = runner.requests.filter(r => r.args.includes('comment'));
  assert.equal(comments.length, 3, '댓글 3개 계약 유지');
  for (const c of comments) assert.ok(!c.args.includes('3역할'), '댓글 경로에는 넣지 않는다(경로 1개)');
});

test('#194 order 핫픽스: 3역할 후보는 최종 ranked entries 순서를 따른다', () => {
  const records = [
    { modelId: 'space-bunny', metric: 'artificial_analysis_intelligence_index', value: 10 },
    { modelId: 'grok-4-7', metric: 'artificial_analysis_intelligence_index', value: 90 },
    { modelId: 'space-bunny', metric: 'artificial_analysis_coding_index', value: 20 },
    { modelId: 'grok-4-7', metric: 'artificial_analysis_coding_index', value: 95 }];
  const ranked = computeRoleTop10(records, {});
  const run = { top10: { records, openrouterRecords: [], failedSources: [], previousRanks: [] } } as unknown as InsightRunResult;
  const out = buildThreeRole(true, run);
  const sel = out!.selection!;
  assert.deepEqual(sel.orchestrator.all.map(c => c.modelId), ranked.orchestrator.entries.map(e => e.modelId), '오케스트레이터 = ranked entries');
  assert.deepEqual(sel.worker.all.map(c => c.modelId), ranked.worker.entries.map(e => e.modelId), '워커 = ranked entries');
  assert.equal(sel.orchestrator.all[0]!.modelId, 'grok-4-7', '선두는 ranked 1위(본문 요약과 동일)'); assert.notEqual(sel.orchestrator.all[0]!.modelId, records[0]!.modelId, 'records 순서를 따르지 않는다');
  // #194 score 배선: 3역할 표는 본문 요약과 같은 표시 보정 스코어(scoreText)를 쓴다.
  const shown = Number(ranked.orchestrator.entries[0]!.scoreText);
  assert.equal(sel.orchestrator.all[0]!.score, shown, 'score = 표시 보정 스코어(scoreText)'); assert.notEqual(sel.orchestrator.all[0]!.score, ranked.orchestrator.entries[0]!.rawScore, 'rawScore 가 아니다');
  assert.equal(ranked.orchestrator.entries[0]!.scoreText, '56.74', '본문 표시 스코어와 3역할 표 스코어 일치');
});

test('#194 pipeline: caps/dedupe reviewer flowing into selection', () => {
  const M = 'artificial_analysis_intelligence_index';
  const R = (id: string, intel: number, spd: number) => [{ modelId: id, metric: M, value: intel, priceInput: 2, priceOutput: 4 },
    { modelId: id, metric: 'median_output_tokens_per_second', value: spd }];
  const records = [...R('claude-sonnet-5-5-high', 80, 60), ...R('claude-sonnet-5-5-xhigh', 99, 60), ...R('muse-spark-1-3-xhigh', 88, 70), ...R('muse-spark-1-3-max', 98, 70)];
  const run = { top10: { records, openrouterRecords: [], failedSources: [], previousRanks: [],
    effortAvailability: { activeProfile: 't', profiles: { t: { caps: { 'claude-sonnet-5-5': 'high', 'muse-spark-1-3': 'xhigh' } } } } } } as unknown as InsightRunResult;
  const rev = buildThreeRole(true, run)!.selection!.top15.reviewer.map(c => c.modelId);
  assert.ok(rev.includes('claude-sonnet-5-5-high'), 'sonnet high 진입'); assert.ok(!rev.includes('claude-sonnet-5-5-xhigh'), 'sonnet xhigh 제외');
  assert.ok(rev.includes('muse-spark-1-3-xhigh'), 'Spark xhigh 진입'); assert.ok(!rev.includes('muse-spark-1-3-max'), 'Spark max 제외');
  assert.equal(new Set(rev.map(id => id.replace(/-(?:high|xhigh|max)$/, ''))).size, rev.length, '같은 base 1행');});
