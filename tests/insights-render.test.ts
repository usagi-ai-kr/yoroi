import assert from 'node:assert/strict';
import test from 'node:test';
import { renderInsights } from '../src/ui/cli/insights-render.js';
import { buildInsightLetter } from '../src/insights/letter.js';
import { validateInsightRecord } from '../src/insights/validation.js';
import { compareInsightPrevious } from '../src/insights/comparison.js';
import { computeInsightTrend } from '../src/insights/trend.js';
import { shiftInsightDate } from '../src/insights/history-port.js';
import type { InsightRecord } from '../src/insights/record.js';
import type { InsightLetterView } from '../src/ui/cli/insights-view.js';

const base: InsightRecord = { source: 'arena', modelId: 'A', metric: 'rating', value: 20, unit: 'score', category: 'Text',
  observedAt: '2026-10-10T10:00:00Z', sourceAsOf: '2026-10-10', sourceUrl: 'https://example.test/data',
  sourceName: 'Synthetic Arena', license: 'CC-BY-4.0', attributionText: 'Source: Synthetic Arena', method: 'synthetic', schemaVersion: 'v1' };
function letter(extra: Partial<InsightRecord> = {}) {
  const checked = validateInsightRecord({ ...base, ...extra }); assert.ok(checked.ok);
  const measurement = checked.value;
  const previous = validateInsightRecord({ ...measurement.record, sourceAsOf: '2026-10-09', value: 10 }); assert.ok(previous.ok);
  const slots = Array.from({ length: 7 }, (_, index) => ({ date: shiftInsightDate('2026-10-10', index - 6) }));
  return buildInsightLetter([{ source: measurement.record.source, ok: true, measurements: [{ measurement,
    comparison: compareInsightPrevious(measurement, previous.value), trend: computeInsightTrend(measurement, slots) }] },
    { source: 'openrouter', ok: false, failure: 'fetch' }], '2026-10-10T15:00:00Z');
}

test('L1 results structurally satisfy the UI contract without conversion', () => {
  const input = letter(); const view: InsightLetterView = input;
  assert.equal(view, input);
});
test('plain and pretty preserve Korean letter, source attribution, dates and channel separation', () => {
  const input = letter(); const before = JSON.stringify(input);
  for (const pretty of [false, true]) {
    const rendered = renderInsights(input, pretty);
    assert.equal(rendered.exitCode, 0);
    for (const text of ['내부 전용', '발행일(KST): 2026-10-11', '2026-10-10T10:00:00Z',
      'https://example.test/data', 'Source: Synthetic Arena', 'CC-BY-4.0', '결측 7일', '초기 적재']) assert.ok(rendered.stdout.includes(text), text);
    assert.match(rendered.stderr, /OpenRouter: 수집 실패/);
    assert.ok(!rendered.stdout.includes('OpenRouter: 수집 실패'));
    assert.equal(JSON.stringify(input), before);
    assert.equal(/[\u001b\u0000\r]/.test(rendered.stdout + rendered.stderr), false);
  }
  assert.match(renderInsights(input, true).stdout, /【요약】/);
  assert.match(renderInsights(input).stdout, /\[요약\]/);
});

test('unknown dates and zero denominators retain exact n/a wording', () => {
  const unknown = renderInsights(letter({ source: 'cognition', sourceAsOf: base.observedAt, license: null }));
  assert.match(unknown.stdout, /n\/a: 기준일 미상/);
  assert.match(unknown.stdout, /비교일 미상/);
  const input = letter(); assert.ok(input.ok);
  const section = input.sections.find(s => s.kind === 'evidence')!;
  (section.rows[0] as { comparison: unknown }).comparison = { comparable: true, currentDate: '2026-10-10',
    previousDate: '2026-10-09', absoluteChange: 20, percentChange: null, percentUnavailable: 'n/a: 이전 값 0' };
  assert.match(renderInsights(input).stdout, /n\/a: 이전 값 0/);
});

test('total failure emits only diagnostics with exit 1 and no successful letter', () => {
  for (const pretty of [false, true]) {
    const rendered = renderInsights({ ok: false, reason: '전체 소스 실패', failedSources: ['arena', 'secret=private'] }, pretty);
    assert.equal(rendered.stdout, ''); assert.equal(rendered.exitCode, 1);
    assert.match(rendered.stderr, /전체 소스 실패/); assert.ok(!rendered.stderr.includes('private'));
  }
});

test('controls, credential fragments and URL credentials/query/hash never reach either channel', () => {
  const cleanInput = letter(); assert.ok(cleanInput.ok);
  const evidence = cleanInput.sections.find(s => s.kind === 'evidence')!.rows[0]!;
  Object.assign(evidence, { modelId: 'A\x1b[31m\nBearer synthetic-token',
    sourceUrl: 'https://user:private@example.test/data?api_key=private#private' });
  const credit = cleanInput.sections.find(s => s.kind === 'sources')!.entries[0]!;
  Object.assign(credit, { attribution: 'Source\x1b]8;;https://private\x07 secret=private sk-private123456' });
  Object.assign(cleanInput.sections.find(s => s.kind === 'failures')!.entries[0]!, { reason: 'Bearer synthetic-token\r secret=private' });
  for (const pretty of [false, true]) {
    const rendered = renderInsights(cleanInput, pretty);
    const output: string = rendered.stdout + rendered.stderr;
    assert.ok(!output.includes('synthetic-token')); assert.ok(!output.includes('private'));
    assert.equal(/[\u001b\u0000\r]/.test(output), false);
  }
});

test('long fields and row counts are bounded and extra raw fields are ignored', () => {
  const input = letter({ modelId: 'A'.repeat(10000) }); assert.ok(input.ok);
  const section = input.sections.find(s => s.kind === 'evidence')!;
  Object.assign(section, { rows: Array.from({ length: 1000 }, () => ({ ...section.rows[0], rawBody: 'synthetic-private' })) });
  const output = renderInsights(input).stdout;
  assert.ok(!output.includes('A'.repeat(1000))); assert.ok(!output.includes('synthetic-private'));
  assert.match(output, /50개 항목까지만 표시/); assert.ok(output.length < 100000);
});

test('rank tables preserve entry, exit and missing distinctions in both formats', () => {
  const input = letter(); assert.ok(input.ok);
  const row = input.sections.find(s => s.kind === 'evidence')!.rows[0]!;
  const changes = ['entered', 'exited', 'missing'].map(status => ({ modelId: status, status,
    currentRank: null, previousRank: null, rankChange: null }));
  Object.assign(input.sections.find(s => s.kind === 'ranks')!, { groups: [{ ...row,
    previousDate: '2026-10-09', result: { comparable: true, changes } }] });
  for (const pretty of [false, true]) for (const text of ['진입', '이탈', '누락', 'n/a'])
    assert.ok(renderInsights(input, pretty).stdout.includes(text));
});
