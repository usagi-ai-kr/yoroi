import assert from 'node:assert/strict';
import test from 'node:test';
import { diffProviderSnapshots, diffRegistry, summarizeDiscoveryDiffs } from '../src/insights/model-discovery-diff.js';
import { checkEligibility, isEligibleModel, isValidCheckedOn, isValidSourceUrl, type EligibilityReason } from '../src/insights/model-discovery-eligibility.js';
import { renderDiscoveryDiffLine, renderDiscoveryDiffNotice } from '../src/insights/model-discovery-render.js';
import { normalizeDiscoveryModelId, type DiscoveredModel } from '../src/insights/model-discovery-types.js';

/** ANSI 제어문자(리터럴 ESC를 소스에 넣지 않고 조합한다). */
const ESC = String.fromCharCode(27);
const model = (over: Partial<DiscoveredModel> = {}): DiscoveredModel => ({
  modelId: 'muse-spark-1-3', displayName: 'Muse Spark 1.3', sourceUrl: 'https://opencode.ai/go',
  checkedOn: '2026-10-20', verified: true, planIds: ['opencode-go-plus'], efforts: ['high'], ...over });

test('정규화는 소문자·공백만 바꾼다 — 날짜형 suffix·벤더 prefix는 보존한다', () => {
  assert.equal(normalizeDiscoveryModelId('  Muse Spark 1.3 '), 'muse-spark-1.3');
  assert.equal(normalizeDiscoveryModelId('DeepSeek-V4-Pro-20260813'), 'deepseek-v4-pro-20260813');
  assert.notEqual(normalizeDiscoveryModelId('deepseek-v4-pro-20260813'), normalizeDiscoveryModelId('deepseek-v4-pro-20260901'));
  assert.equal(normalizeDiscoveryModelId('nvidia-nemotron-3-super'), 'nvidia-nemotron-3-super');
});

test('편입 게이트는 5개 메타데이터를 요구한다 — URL 모양은 공식 확인을 대체하지 못한다', () => {
  assert.equal(isEligibleModel(model()), true);
  assert.deepEqual(checkEligibility([model()]).eligible.length, 1);
  assert.deepEqual(checkEligibility([model()]).rejected, []);
  assert.equal(isValidSourceUrl('https://opencode.ai/go'), true);
  assert.equal(isValidCheckedOn('2026-10-20'), true);
  const cases: [Partial<DiscoveredModel>, EligibilityReason][] = [
    [{ verified: false }, 'unverified'], [{ sourceUrl: 'http://opencode.ai/go' }, 'invalid-source-url'], [{ sourceUrl: 'not-a-url' }, 'invalid-source-url'],
    [{ checkedOn: '2026-02-30' }, 'invalid-checked-on'], [{ checkedOn: '2026-13-01' }, 'invalid-checked-on'], [{ checkedOn: '2026-10' }, 'invalid-checked-on'],
    [{ planIds: [] }, 'missing-tier'], [{ efforts: [] }, 'missing-effort'], [{ modelId: 'bad id!' }, 'invalid-model-id'],
  ];
  for (const [over, reason] of cases) {
    const report = checkEligibility([model(over)]);
    assert.equal(report.eligible.length, 0, JSON.stringify(over));
    assert.ok(report.rejected[0]?.reasons.includes(reason), `${JSON.stringify(over)} → ${reason}`);
  }
  const noEfforts = { ...model(), efforts: undefined as unknown as readonly string[] };
  assert.ok(checkEligibility([noEfforts]).rejected[0]?.reasons.includes('missing-effort'));
  const input = model({ verified: false });
  assert.equal(checkEligibility([input]).eligible.length, 0);
  assert.equal(input.verified, false, '코드가 verified를 바꾸지 않는다');
  assert.equal(checkEligibility([input]).rejected[0]?.reasons.includes('unverified'), true);
});

test('같은 id가 중복되면 그 id 전체를 거부한다(모호 fail-closed)', () => {
  const report = checkEligibility([model(), model({ displayName: '다른 표기' })]);
  assert.equal(report.eligible.length, 0);
  assert.equal(report.rejected.length, 2);
  for (const rejected of report.rejected) assert.ok(rejected.reasons.includes('duplicate-model-id'));
});

test('diff는 추가·부재·변경을 분리한다', () => {
  const t = '2026-10-20T00:00:00.000Z';
  const diff = diffRegistry('opencode', t, [model(), model({ modelId: 'grok-4-7', displayName: 'Grok 4.7' })],
    [model({ displayName: 'Muse Spark 1.3 (updated)' }), model({ modelId: 'kimi-k3', displayName: 'Kimi K3' })]);
  assert.deepEqual([diff.added.map(m => m.modelId), diff.removed, diff.changed],
    [['kimi-k3'], ['grok-4-7'], [{ modelId: 'muse-spark-1-3', fields: ['displayName'] }]]);
});

test('순서·중복만 다른 목록과 유사 이름은 허위 변경이 아니다', () => {
  const diff = diffRegistry('opencode', '2026-10-20T00:00:00.000Z',
    [model({ planIds: ['b', 'a'], efforts: ['high', 'high'] })], [model({ planIds: ['a', 'b', 'a'], efforts: ['high'] })]);
  assert.deepEqual([diff.changed, diff.added], [[], []]);
  const similar = diffRegistry('ollama', '2026-10-20T00:00:00.000Z', [], [model({ modelId: 'muse-spark-1-3' }), model({ modelId: 'muse-spark-open', displayName: 'Muse Spark Open' })]);
  assert.deepEqual(similar.added.map(m => m.modelId), ['muse-spark-1-3', 'muse-spark-open']);
});

test('provider별로 비교를 분리한다', () => {
  const diffs = diffProviderSnapshots(
    [{ generation: 1, observedAt: '2026-10-19T00:00:00.000Z', providerId: 'opencode', models: [model()] }],
    [{ generation: 1, observedAt: '2026-10-20T00:00:00.000Z', providerId: 'ollama', models: [model({ modelId: 'kimi-k3' })] }]);
  assert.equal(diffs.length, 2);
  assert.deepEqual([diffs.find(d => d.providerId === 'opencode')?.removed, diffs.find(d => d.providerId === 'ollama')?.added.map(m => m.modelId), diffs.find(d => d.providerId === 'opencode')?.added],
    [['muse-spark-1-3'], ['kimi-k3'], []]);
});

test('stdout 알림은 1줄이며 변경이 없으면 내보내지 않는다', () => {
  const summary = summarizeDiscoveryDiffs([diffRegistry('opencode', '2026-10-20T00:00:00.000Z', [], [model()])]);
  assert.deepEqual(summary, { observedAt: '2026-10-20T00:00:00.000Z', providers: 1, added: 1, removed: 0, changed: 0 });
  assert.equal(renderDiscoveryDiffLine(summary), '2026-10-20T00:00:00.000Z discovery registry-diff providers=1 added=1 removed=0 changed=0');
  const quiet = summarizeDiscoveryDiffs([diffRegistry('opencode', '2026-10-20T00:00:00.000Z', [model()], [model()])]);
  assert.deepEqual([renderDiscoveryDiffNotice(quiet), renderDiscoveryDiffNotice(summary)], [undefined, renderDiscoveryDiffLine(summary)]);
});

test('모호 id는 added/removed/changed 모두 보류하고 정상 변경은 보존한다', () => {
  const t = '2026-10-20T00:00:00.000Z', m = model(), dup = model({ displayName: '별칭' });
  const fwd = diffRegistry('opencode', t, [m], [m, dup]);
  const bwd = diffRegistry('opencode', t, [m, dup], [m]);
  for (const d of [fwd, bwd]) assert.deepEqual([d.added, d.removed, d.changed], [[], [], []]);
  const co = diffRegistry('opencode', t, [m, model({ modelId: 'old-1' })], [m, dup, model({ modelId: 'new-1' })]);
  assert.deepEqual(co.added.map(x => x.modelId), ['new-1']);
  assert.deepEqual([co.removed, co.changed], [['old-1'], []]);
});

test('알림 줄은 제어문자를 제거하고 길이를 제한한다', () => {
  const summary = summarizeDiscoveryDiffs([diffRegistry('opencode', `${ESC}[31m2026-10-20T00:00:00.000Z`, [], [model()])]), line = renderDiscoveryDiffLine(summary);
  assert.equal(line.includes(ESC), false);
  assert.ok(line.length < 200);
  assert.ok(line.startsWith('2026-10-20T00:00:00.000Z discovery registry-diff'));
});
