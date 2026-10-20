import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { renderRoleTable } from '../src/insights/letter-markdown-tables.js';
import { orchestratorVariants, pickEffortValues, type Raw } from '../src/insights/letter-top10-score-raw.js';
import { effortWithinCap, loadEffortAvailability, resolveAvailability, type EffortAvailability } from '../src/insights/letter-effort-availability.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
/** #188: 환경·프로필별 effort 가용성. 관측 상한은 점수·표시를 함께 좁히고, 미검증은 이론값 표기만 한다. */
const INTEL = 'artificial_analysis_intelligence_index';
const aa = (modelId: string, value: number, price = 1): Top10RecordInput =>
  ({ modelId, metric: INTEL, value, priceInput: price, priceOutput: price });
const catalogOf = (ids: readonly string[]): readonly PlanCatalogEntry[] =>
  [{ planId: 'e-test', planName: 'E Test', models: ids.map(modelId =>
    ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-19', verified: true })) }];
const av: EffortAvailability = { activeProfile: 'observed-2026-10-19', profiles: { 'observed-2026-10-19': {
  observedAt: '2026-10-19', caps: { 'muse-spark-1-3': 'xhigh', 'claude-sonnet-5-5': 'high' },
  unverifiedApproximate: { 'approx-model': 'high' }, aliases: { spark: 'muse-spark-1-3' } } } };

test('cap 규칙: 순서 비교, default는 baseline, cap 미지는 항상 통과', () => {
  assert.deepEqual([effortWithinCap('max', 'xhigh'), effortWithinCap('xhigh', 'xhigh'), effortWithinCap('default', 'xhigh')], [false, true, true]);
  assert.deepEqual([effortWithinCap('max', undefined), effortWithinCap('low', 'medium')], [true, true]);
});

test('프로필 해석: capped·unverified·unlisted과 alias 키', () => {
  assert.deepEqual(resolveAvailability('muse-spark-1.3', av), { mode: 'capped', cap: 'xhigh', profile: 'observed-2026-10-19', observedAt: '2026-10-19' });
  assert.equal(resolveAvailability('spark', av).mode, 'capped', 'alias도 같은 cap을 받는다');
  assert.equal(resolveAvailability('claude-sonnet-5-5', av).mode, 'capped', '관측 상한이 있으면 capped');
  assert.equal(resolveAvailability('approx-model', av).mode, 'unverified', '근사 보고는 상한이 아니라 미확인이다');
  assert.equal(resolveAvailability('other-model', av).mode, 'unlisted');
  assert.equal(resolveAvailability('muse-spark-1-3', undefined).mode, 'unlisted', '정책 없으면 모델 전역 상한도 없다');
  assert.throws(() => resolveAvailability('x', { activeProfile: 't', profiles: { t: { caps: { x: 'ultra' } } } }), /ORCHESTRATOR_EFFORT_ORDER 밖/);
});

test('오케: cap이 있으면 cap 밖 변형이 후보에서 빠진다', () => {
  const raw: Raw = { aaEffort: new Map([['xhigh', 40], ['max', 41]]) };
  assert.deepEqual(orchestratorVariants(raw, 'xhigh'), ['xhigh']);
  assert.deepEqual(orchestratorVariants(raw), ['xhigh', 'max'], 'cap 없으면 기존 동작');
  assert.deepEqual(orchestratorVariants({ aaEffort: new Map([['max', 41]]) }, 'xhigh'), ['default'], 'cap 안 관측이 없으면 default 단일');
});

test('워커: 극값·fallback best가 cap 안 관측치로만 모인다 (점수=표시 effort)', () => {
  const r: Raw = { aaSpeedE: new Map([['max', 500], ['xhigh', 300]]), cogEffort: new Map([['max', 0.9], ['xhigh', 0.5]]) };
  pickEffortValues(r, 'xhigh', 'worker', 'xhigh');
  assert.equal(r.aaSpeed, 300, 'max 관측 500은 점수에 들어가지 않는다');
  assert.equal(r.cogCorrect, 0.5);
  const c: Raw = { cogEffort: new Map([['max', 0.9], ['high', 0.5]]) };
  pickEffortValues(c, 'high', 'worker', 'high');
  assert.equal(c.cogCorrect, 0.5, 'fallback best도 cap 안에서만');
});

test('오케 변형: 속도 fallback도 cap 밖 관측치를 쓰지 않는다', () => {
  const r: Raw = { aaEffort: new Map([['xhigh', 40]]), cogDurE: new Map([['max', 1], ['xhigh', 10]]), aaSpeedE: new Map([['max', 500]]) };
  pickEffortValues(r, 'xhigh', 'orchestrator', 'xhigh');
  assert.equal(r.aaSpeed, undefined, 'max 속도 500이 xhigh 변형에 새지 않는다');
  assert.equal(r.cogDuration, 10);
});

test('레터: 상한 모델은 cap 안 effort 추천·AA 지수 일치, 이론값은 별도 표기, Top7·Top15 동일', () => {
  const records = [aa('muse-spark-1-3-xhigh', 40), aa('muse-spark-1-3-max', 41), aa('claude-sonnet-5-5-high', 44), aa('claude-sonnet-5-5-max', 45)];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['muse-spark-1-3', 'claude-sonnet-5-5', 'plain']), effortAvailability: av });
  for (const role of ['orchestrator', 'worker'] as const) {
    const muse = lists[role].entries.find(e => e.modelId === 'muse-spark-1-3')!;
    assert.deepEqual([muse.repEffort, muse.effortAvailability, muse.indexText], ['xhigh', 'capped', '40.0'], `${role}: 점수 입력이 cap 안 xhigh 40과 일치`);
    assert.equal(muse.benchmarkEffort, 'max', `${role}: 이론 최적 effort는 별도 필드다`);
    const sonnet = lists[role].entries.find(e => e.modelId === 'claude-sonnet-5-5')!;
    assert.deepEqual([sonnet.repEffort, sonnet.effortAvailability, sonnet.benchmarkEffort], ['high', 'capped', 'max'], `${role}: cap 안 effort 로만 추천`);
  }
  const unlisted = computeRoleTop10([aa('plain-max', 39)], { catalog: catalogOf(['plain']), effortAvailability: av });
  assert.equal(unlisted.orchestrator.entries[0]?.repEffort, 'max', 'cap 없는 모델은 관측 effort 를 그대로 쓴다');
  assert.equal(unlisted.orchestrator.entries[0]?.effortAvailability, 'unlisted', '표기만 unlisted(plain)');
  for (const table of [renderRoleTable('orchestrator', lists.orchestrator, 'H', 7), renderRoleTable('orchestrator', lists.orchestrator, 'H')]) {
    // #194: effort 칸은 plain 만( (미확인)·(상한)·범례 없음 ).
    assert.match(table, /\| muse-spark-1-3 \| xhigh \|/);
    assert.match(table, /\| claude-sonnet-5-5 \| high \|/);
    assert.ok(!table.includes('미확인') && !table.includes('(상한)'), 'effort 미확인·상한 표기가 없다');
  }
});

test('loader: 파일 없으면 정책 없음, 활성화는 런타임 선택자로만, 값 오류는 예외', async () => {
  assert.equal(loadEffortAvailability('/nonexistent/effort-availability.json'), undefined);
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path'); const { tmpdir } = await import('node:os');
  const path = join(tmpdir(), `effort-av-${process.pid}-${Date.now()}`, 'effort-availability.json');
  await mkdir(join(path, '..'), { recursive: true });  await writeFile(path, JSON.stringify({ profiles: { bad: { caps: { x: 'ultra' } }, t: { caps: { m: 'low' } } } }));
  assert.throws(() => loadEffortAvailability(path), /ORCHESTRATOR_EFFORT_ORDER 밖/, '모든 프로필의 cap 값을 검증한다');
  await writeFile(path, JSON.stringify({ profiles: { t: { caps: { m: 'low' } } } }));
  const prev = process.env.YOROI_EFFORT_PROFILE; try {
    process.env.YOROI_EFFORT_PROFILE = '';
    assert.equal(resolveAvailability('m', loadEffortAvailability(path)).mode, 'unlisted', '선택자 없으면 관측 프로필 비활성');
    process.env.YOROI_EFFORT_PROFILE = 'missing';
    assert.throws(() => loadEffortAvailability(path), /프로필 'missing'/);
    process.env.YOROI_EFFORT_PROFILE = 't';
    assert.deepEqual([loadEffortAvailability(path)?.activeProfile, resolveAvailability('m', loadEffortAvailability(path)).cap], ['t', 'low']);
    // #194: 설정의 defaultProfile 이 env 미지정 시 활성화된다(env 지정이 우선).
    await writeFile(path, JSON.stringify({ defaultProfile: 't', profiles: { t: { caps: { m: 'low' } } } }));
    delete process.env.YOROI_EFFORT_PROFILE;
    assert.equal(loadEffortAvailability(path)?.activeProfile, 't', 'defaultProfile 이 활성화된다');
  } finally { if (prev === undefined) delete process.env.YOROI_EFFORT_PROFILE; else process.env.YOROI_EFFORT_PROFILE = prev; }
});
