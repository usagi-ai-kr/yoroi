import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateInsightRecord, validateInsightRows } from '../src/insights/validation.js';
import { parseArenaRows } from '../src/insights/arena-parser.js';
import { parseAaResponse } from '../src/insights/aa-parser.js';
import { parseCognitionResponse } from '../src/insights/cognition-parser.js';
import { parseOpenRouterResponse } from '../src/insights/openrouter-parser.js';
import type { InsightRecord } from '../src/insights/record.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';

const now = '2026-10-11T00:00:00Z';
const base: InsightRecord = { source: 'arena', modelId: 'synthetic', metric: 'rating', value: 0,
  unit: 'score', category: 'Text', observedAt: now, sourceAsOf: '2026-10-10',
  sourceUrl: 'https://example.test/data', sourceName: 'Synthetic', license: null,
  attributionText: 'Synthetic attribution', method: 'synthetic', schemaVersion: 'v1' };
const row = (...records: InsightRecord[]): ParseRowResult => ({ ok: true, index: 0, records, warnings: [] });
const failed: ParseRowResult = { ok: false, index: 1, reason: 'synthetic', warnings: [] };
const fixture = (name: string): unknown => JSON.parse(readFileSync(
  new URL(`./fixtures/insights/${name}-sample.json`, import.meta.url), 'utf8'));

test('empty results, every failed row and zero measurements cannot become source success', () => {
  assert.deepEqual(validateInsightRows('arena', []), { ok: false, reason: 'empty-result', rejectedRows: 0 });
  assert.deepEqual(validateInsightRows('arena', [failed]), { ok: false, reason: 'all-rows-failed', rejectedRows: 1 });
  assert.deepEqual(validateInsightRows('arena', [row()]), { ok: false, reason: 'no-valid-measurements', rejectedRows: 0 });
  assert.equal(validateInsightRows('unknown', [row(base)]).ok, false);
});

test('required persistence fields, unknown sources and non-finite metrics are rejected', () => {
  for (const key of Object.keys(base)) {
    const missing = { ...base } as Record<string, unknown>; delete missing[key];
    assert.equal(validateInsightRecord(missing).ok, false, key);
  }
  for (const change of [{ source: 'unknown' }, { value: NaN }, { value: Infinity }, { value: '0' },
    { modelId: ' ' }, { category: '' }, { sourceUrl: 'file:///tmp/x' }, { sourceUrl: 'https://u:p@example.test' },
    { observedAt: '2026-02-30T00:00:00Z' }, { observedAt: '2026-10-11T00:00:00+00:00' },
    { sourceAsOf: '2026-02-30' }, { license: undefined }, { metadata: { raw: undefined } }]) {
    assert.equal(validateInsightRecord({ ...base, ...change }).ok, false);
  }
  assert.equal(validateInsightRecord(null).ok, false);
  assert.equal(validateInsightRecord(base).ok, true, 'zero is a real measurement');
});

test('malformed rows are atomic, valid rows survive, source identity cannot cross a cache boundary', () => {
  const invalid = { ...base, unit: '' };
  const result = validateInsightRows('arena', [row(base, invalid), failed, row(base)]);
  assert.equal(result.ok, true);
  if (result.ok) { assert.equal(result.records.length, 1); assert.equal(result.rejectedRows, 2); }
  assert.equal(validateInsightRows('cognition', [row(base)]).ok, false);
  const duplicate = validateInsightRows('arena', [row(base), row()]);
  assert.equal(duplicate.ok, true, 'parser-skipped duplicate rows are not source failure');
});

test('3-A keeps AA/Cognition latest values but never treats observedAt as a comparison date', () => {
  for (const source of ['artificial-analysis', 'cognition'] as const) {
    const original = { ...base, source, sourceAsOf: now,
      metadata: { sourceAsOfBasis: 'observedAt-fallback' } };
    const copy = JSON.stringify(original);
    const result = validateInsightRecord(original);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.comparisonDate, null);
      assert.equal(result.value.comparisonUnavailable, 'n/a: 기준일 미상');
      assert.equal(result.value.record.sourceAsOf, now);
    }
    assert.equal(JSON.stringify(original), copy);
    const noMarker = validateInsightRecord({ ...original, metadata: {} });
    assert.ok(noMarker.ok && noMarker.value.comparisonDate === null);
  }
});

test('all shipped parsers remain accepted and OpenRouter uses metadata.date rather than sourceAsOf', () => {
  const parsed = [parseArenaRows(fixture('arena') as unknown[], now), parseAaResponse(fixture('aa'), now),
    parseCognitionResponse(fixture('cognition'), now), parseOpenRouterResponse(fixture('openrouter'), now)];
  for (const rows of parsed) {
    const records = rows.flatMap(r => r.ok ? r.records : []);
    assert.ok(records.length > 0);
    for (const record of records) assert.equal(validateInsightRecord(record).ok, true, record.source);
  }
  const record = { ...base, source: 'openrouter' as const, sourceAsOf: now, metadata: { date: '2026-10-09' } };
  const result = validateInsightRecord(record);
  assert.ok(result.ok && result.value.comparisonDate === '2026-10-09');
  assert.equal(validateInsightRecord({ ...record, metadata: {} }).ok, false);
});

test('malformed record containers and cyclic metadata fail without echoing input', () => {
  const metadata: Record<string, unknown> = { privateValue: 'synthetic-secret' }; metadata.self = metadata;
  const result = validateInsightRecord({ ...base, metadata });
  assert.deepEqual(result, { ok: false, reason: 'invalid-record' });
  assert.equal(JSON.stringify(result).includes('synthetic-secret'), false);
  assert.equal(validateInsightRows('arena', [row(null as unknown as InsightRecord)]).ok, false);
  assert.equal(validateInsightRecord({ ...base, metadata: { sourceAsOfBasis: 'observedAt-fallback' } }).ok, false);
});
