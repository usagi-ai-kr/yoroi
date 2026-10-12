import assert from 'node:assert/strict';
import test from 'node:test';
import {
  renderTrendText, renderTrendPretty, renderTrendJsonl, renderSparkline, type SeriesTrendResult,
} from '../src/ui/cli/trend-render.js';

const sampleResult: SeriesTrendResult = {
  provider: 'claude',
  windowId: '5h',
  unit: 'percent',
  contractVersion: '1',
  periods: {
    '24h': {
      period: '24h', sampleCount: 12, delta: 15.5, ratePerHour: 0.65,
      resets: 0, gaps: 0, status: 'sufficient',
      first: { at: '2026-10-10T12:00:00Z', value: 10 },
      last: { at: '2026-10-11T12:00:00Z', value: 25.5 },
    },
    '7d': {
      period: '7d', sampleCount: 84, delta: 45.0, ratePerHour: 0.27,
      resets: 1, gaps: 0, status: 'sufficient',
      first: { at: '2026-10-04T12:00:00Z', value: 5 },
      last: { at: '2026-10-11T12:00:00Z', value: 50 },
    },
  },
  sparklinePoints: [10, 15, 20, 25, 30, 40, 50],
};

const insufficientResult: SeriesTrendResult = {
  provider: 'codex',
  windowId: '1d',
  unit: 'tokens',
  contractVersion: '1',
  periods: {
    '24h': {
      period: '24h', sampleCount: 1, delta: null, ratePerHour: null,
      resets: 0, gaps: 0, status: 'insufficient',
    },
  },
};

test('renderTrendText formats plain text for dual periods and single since', () => {
  const dual = renderTrendText([sampleResult]);
  assert.equal(dual.length, 1);
  assert.match(dual[0]!, /^claude 5h percent 24h: delta=\+15\.5%p rate=\+0\.65%p\/h samples=12 \| 7d: delta=\+45%p rate=\+0\.27%p\/h samples=84 resets=1 gaps=0$/);

  const since7d = renderTrendText([sampleResult], '7d');
  assert.equal(since7d.length, 1);
  assert.match(since7d[0]!, /^claude 5h percent 7d: delta=\+45%p rate=\+0\.27%p\/h samples=84 resets=1 gaps=0$/);
});

test('renderTrendText formats insufficient samples message', () => {
  const text = renderTrendText([insufficientResult]);
  assert.equal(text.length, 1);
  assert.ok(text[0]!.includes('samples=1 (샘플 부족)'));
});

test('renderSparkline outputs scaled sparkline characters', () => {
  const spark = renderSparkline([0, 10, 20, 30]);
  assert.equal(spark, ' ▃▅█');
  assert.equal(renderSparkline([5]), '-');
  assert.equal(renderSparkline([5, 5, 5]), '▄▄▄');
});

test('renderTrendPretty outputs table with expected headers and cells', () => {
  const lines = renderTrendPretty([sampleResult, insufficientResult]);
  const joined = lines.join('\n');
  assert.ok(joined.includes('Provider'));
  assert.ok(joined.includes('Window'));
  assert.ok(joined.includes('7d Sparkline'));
  assert.ok(joined.includes('claude'));
  assert.ok(joined.includes('codex'));
  assert.ok(joined.includes('샘플 부족'));
});

test('renderTrendJsonl outputs valid JSONL and preserves UTC without sensitive info', () => {
  const lines = renderTrendJsonl([sampleResult]);
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]!);
  assert.equal(parsed.provider, 'claude');
  assert.equal(parsed.windowId, '5h');
  assert.equal(parsed.contractVersion, '1');
  assert.equal(parsed.periods['24h'].firstAt, '2026-10-10T12:00:00Z');
  assert.equal(parsed.periods['7d'].delta, 45);

  const rawJson = lines[0]!;
  assert.doesNotMatch(rawJson, /account_scope|yoroi\.db|\/Users|\/home|token|key|secret/i);
});
