import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ArenaParseError, parseArenaRow, parseArenaRows } from '../src/insights/arena-parser.js';
import type { InsightMetadataValue } from '../src/insights/record.js';

const observedAt = '2026-01-04T12:00:00.000Z';
const fixture = JSON.parse(await readFile(new URL('./fixtures/insights/arena-sample.json', import.meta.url), 'utf8')) as unknown[];
const standardRow = fixture[0] as Record<string, unknown>;
const agentRow = fixture[1] as Record<string, unknown>;

test('normalizes documented standard Arena metrics and provenance', () => {
  const records = parseArenaRow(standardRow, observedAt);
  assert.deepEqual(records.map(record => [record.metric, record.value, record.unit]), [
    ['rating', 1000.5, 'score'], ['rating_lower', 990.25, 'score'],
    ['rating_upper', 1010.75, 'score'], ['variance', 12.5, 'score-squared'],
    ['vote_count', 40, 'battles'], ['rank', 2, 'rank'],
  ]);
  assert.equal(records[0]?.source, 'arena');
  assert.equal(records[0]?.modelId, 'synthetic-model-standard');
  assert.equal(records[0]?.modelAlias, undefined);
  assert.equal(records[0]?.license, 'CC-BY-4.0');
  assert.equal(records[0]?.sourceName, 'lmarena-ai LMArena Leaderboard Dataset');
  assert.match(records[0]?.attributionText ?? '', /lmarena-ai.*CC-BY-4.0.*huggingface/);
  assert.equal(records[0]?.metadata?.modelLicense, 'synthetic-license');
  assert.equal(records[0]?.category, 'synthetic-category');
  assert.equal(records[0]?.observedAt, observedAt);
  assert.equal(records[0]?.sourceAsOf, '2026-01-02');
  assert.equal(records[0]?.method, 'bradley-terry');
  assert.equal(records[0]?.schemaVersion, 'arena-hf-v1');
});

test('normalizes IPS rows and permits aggregate-only session_count omission', () => {
  const records = parseArenaRow(agentRow, observedAt);
  assert.deepEqual(records.map(record => record.metric), [
    'score', 'score_ci_lower', 'score_ci_upper', 'observation_count', 'session_count', 'rank',
  ]);
  assert.ok(records.every(record => record.method === 'ips'));
  const { session_count: _session, ...perSignal } = agentRow;
  assert.deepEqual(parseArenaRow(perSignal, observedAt).map(record => record.metric), [
    'score', 'score_ci_lower', 'score_ci_upper', 'observation_count', 'rank',
  ]);
});

test('accepts nested provider metadata while keeping metric values numeric', () => {
  const metadata: InsightMetadataValue = {
    release_date: '2026-01-01', pricing: { input: 1, output: '2', cache: { read: 0.5 } },
    version: 'synthetic-v1', prompt_tokens: 12,
  };
  assert.ok(metadata);
  assert.equal(typeof parseArenaRow(standardRow, observedAt)[0]?.value, 'number');
});

test('isolates row errors, warns on unknown columns, and continues the batch', () => {
  const drift = { ...standardRow, new_metric: 'synthetic' };
  const missing = { ...standardRow };
  delete missing.rating;
  const invalid = { ...agentRow, rank: 1.5 };
  const outcomes = parseArenaRows([standardRow, missing, drift, invalid, agentRow], observedAt);
  assert.deepEqual(outcomes.map(result => result.ok), [true, false, true, false, true]);
  assert.deepEqual(outcomes.map(result => result.index), [0, 1, 2, 3, 4]);
  assert.deepEqual(outcomes.map(result => result.ok ? result.records.length : result.reason),
    [6, 'Arena row invalid-row', 6, 'Arena row invalid-row', 6]);
  assert.deepEqual(outcomes[2]?.warnings, ['Ignored unknown columns: new_metric']);
  assert.equal(parseArenaRow(drift, observedAt).length, 6);
  const crossFamily = parseArenaRows([{ ...standardRow, score: 0.3, score_ci_lower: 0.2,
    session_count: 4 }], observedAt)[0];
  assert.deepEqual(crossFamily?.ok && crossFamily.warnings,
    ['Ignored unknown columns: score, score_ci_lower, session_count']);
  assert.throws(() => parseArenaRow(missing, observedAt),
    (error: unknown) => error instanceof ArenaParseError && error.code === 'invalid-row');
});

test('preserves source dates and validates calendar dates without timezone conversion', () => {
  const leapDay = { ...standardRow, leaderboard_publish_date: '2024-02-29' };
  assert.equal(parseArenaRow(leapDay, observedAt)[0]?.sourceAsOf, '2024-02-29');
  assert.throws(() => parseArenaRow({ ...leapDay, leaderboard_publish_date: '2026-02-30' }, observedAt),
    (error: unknown) => error instanceof ArenaParseError && error.code === 'invalid-row');
  assert.throws(() => parseArenaRow(standardRow, 'not-a-time'),
    (error: unknown) => error instanceof ArenaParseError && error.code === 'invalid-row');
  assert.throws(() => parseArenaRow(standardRow, '2026-02-30T12:00:00Z'),
    (error: unknown) => error instanceof ArenaParseError && error.code === 'invalid-row');
});
