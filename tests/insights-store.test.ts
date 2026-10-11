import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { openInsightsHistory } from '../src/infra/sqlite/insights-store.js';
import type { InsightDailyKey, InsightHistoryPort, InsightSeriesKey } from '../src/insights/history-port.js';
import { validateInsightRows, type InsightValidation } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';
const key: InsightDailyKey = { source: 'arena', publicationDate: '2026-10-11', requestScope: 'text:public', schemaVersion: 'v1' };
const base: InsightRecord = { source: 'arena', modelId: 'synthetic', metric: 'rating', value: 10,
  unit: 'score', category: 'Text', observedAt: '2026-10-11T00:00:00Z', sourceAsOf: '2026-10-10',
  sourceUrl: 'https://example.test/data', sourceName: 'Synthetic', license: null,
  attributionText: 'Synthetic', method: 'synthetic', schemaVersion: 'v1' };  // 합성 전용
const series: InsightSeriesKey = { ...key, modelId: base.modelId, metric: base.metric, unit: base.unit, category: base.category };
const success = (changes: Partial<InsightRecord> = {}): InsightValidation => {
  const record = { ...base, ...changes };
  return validateInsightRows(record.source, [{ ok: true, index: 0, records: [record], warnings: [] }]); };
const roots: string[] = [];
function sqlite(): ReturnType<typeof openInsightsHistory> {   // 매 케이스 새 임시 DB
  const root = mkdtempSync(join(tmpdir(), 'yoroi-insights-store-')); roots.push(root);
  return openInsightsHistory({ YOROI_DATA_DIR: join(root, 'data') }); }
test.after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
const withStore = <T>(run: (store: InsightHistoryPort) => T): T => {
  const db = sqlite(); try { return run(db); } finally { db.close(); } };

/** S1 계약 케이스. 메모리·SQLite 양쪽에 같은 단언을 그대로 돌려 동일성을 증명한다. */
const CASES: readonly (readonly [string, (store: InsightHistoryPort) => void])[] = [
  ['a failure, a reuse and a failed refresh never disturb the stored success', (store) => {
    const failed = validateInsightRows('arena', []);
    assert.equal(store.saveDaily(key, failed), false); assert.equal(store.getDaily(key), undefined);
    assert.equal(store.saveDaily(key, success()), true);
    assert.equal(store.saveDaily(key, success({ value: 20 })), false);
    assert.equal(store.saveDaily(key, failed, { refresh: true }), false);
    assert.equal(store.saveDaily(key, success({ value: 20 }), { refresh: true, complete: false }), false);
    assert.equal(store.getDaily(key)?.records[0]?.record.value, 10, '실패 갱신은 기존 성공을 지우지 않는다');
    assert.equal(store.saveDaily(key, success({ value: 20 }), { refresh: true }), true);
    assert.equal(store.getDaily(key)?.records[0]?.record.value, 20);
    assert.equal(store.getDaily({ ...key, publicationDate: '2026-10-12' }), undefined);
    for (const changed of [{ requestScope: 'text:pro' }, { schemaVersion: 'v2' }, { source: 'cognition' as const }])
      assert.equal(store.getDaily({ ...key, ...changed }), undefined, '키가 다르면 다른 일일 결과다'); }],
  ['an incomplete page and a failed source are never stored and retry the same day', (store) => {
    assert.equal(store.saveDaily(key, success(), { complete: false }), false);
    assert.equal(store.saveDaily(key, validateInsightRows('arena', [])), false);
    assert.equal(store.getDaily(key), undefined); assert.equal(store.saveDaily(key, success()), true);
    assert.equal(store.saveDaily(key, success({ value: 99 }), { complete: false }), false);
    assert.equal(store.getDaily(key)?.records[0]?.record.value, 10); }],
  ['an exact previous day is required and seven days keep real gaps', (store) => {
    store.saveDaily(key, success({ sourceAsOf: '2026-10-08' }));
    store.saveDaily({ ...key, publicationDate: '2026-10-12' }, success());
    assert.equal(store.previous(series, '2026-10-10'), undefined, '가장 가까운 과거 값으로 대체하지 않는다');
    assert.equal(store.previous(series, '2026-10-11')?.record.value, 10);
    const days = store.sevenDays(series, '2026-10-11');
    assert.deepEqual(days.map(day => day.date),
      Array.from({ length: 7 }, (_, i) => `2026-10-${String(i + 5).padStart(2, '0')}`));
    assert.equal(days.filter(day => day.measurement).length, 2, '결측 슬롯은 비어 있다');
    for (const change of [{ modelId: 'other' }, { unit: 'tokens' }, { metric: 'rank' }, { category: 'Code' }])
      assert.equal(store.previous({ ...series, ...change }, '2026-10-11'), undefined, '시리즈 축이 다르면 조회 안 된다');
    store.saveDaily({ ...key, publicationDate: '2026-10-13' }, success({ value: 30 }));
    assert.equal(store.previous(series, '2026-10-11')?.record.value, 30);
    assert.equal(store.previous(series, '2026-10-09')?.record.value, 10); }],
  ['an unknown basis keeps the daily latest result without inventing dated history', (store) => {
    const cognition = { ...key, source: 'cognition' as const };
    assert.equal(store.saveDaily(cognition, success({ source: 'cognition', sourceAsOf: base.observedAt })), true);
    assert.equal(store.getDaily(cognition)?.records[0]?.comparisonDate, null);
    assert.ok(store.sevenDays({ ...series, source: 'cognition' }, '2026-10-11')
      .every(day => !day.measurement), '기준일 미상은 날짜 이력을 만들지 않는다');
    assert.equal(store.saveDaily(key, success({ schemaVersion: 'v2' })), false);
    assert.equal(store.saveDaily(key, { ok: true, source: 'arena', records: [], rejectedRows: 0 }), false);
    assert.equal(store.saveDaily(key, success({ source: 'cognition' })), false); }],
  ['retention keeps 90 publication days and a later day replaces the same comparison date', (store) => {
    const result = success();
    store.saveDaily({ ...key, publicationDate: '2026-07-13' }, result);
    store.saveDaily({ ...key, publicationDate: '2026-07-14' }, success({ sourceAsOf: '2026-10-09' }));
    if (result.ok) (result.records[0]!.record as { value: number }).value = 999;
    assert.equal(store.getDaily({ ...key, publicationDate: '2026-07-13' })?.records[0]?.record.value, 10);
    const read = store.previous(series, '2026-10-11')!; (read.record as { value: number }).value = 999;
    assert.equal(store.previous(series, '2026-10-11')?.record.value, 10, '반환값 변경이 저장본에 새지 않는다');
    assert.equal(store.prune('2026-10-11'), 1); assert.equal(store.previous(series, '2026-10-11'), undefined);
    assert.equal(store.previous(series, '2026-10-10')?.record.value, 10); }],
  ['only normalized fields persist and a forged comparison date cannot move history', (store) => {
    const validated = success(); assert.ok(validated.ok);
    const record = { ...validated.records[0]!.record, rawBody: 'synthetic-private', requestScope: 'other' };
    assert.equal(store.saveDaily(key, { ...validated, records: [{ record, comparisonDate: '2020-01-01' }] }), true);
    assert.equal(store.previous(series, '2026-10-11')?.comparisonDate, '2026-10-10', '위조 날짜는 무시된다');
    assert.equal('rawBody' in store.getDaily(key)!.records[0]!.record, false, '원문 필드는 저장되지 않는다');
    assert.throws(() => store.getDaily({ ...key, requestScope: 'token=private' }), RangeError); }],
];

test('the SQLite store satisfies every memory contract case', () => {
  for (const [name, run] of CASES) { run(new MemoryInsightHistory()); withStore(run); assert.ok(true, name); } });


test('both stores expose identical observable values for the same scenario', () => {
  for (const [name, run] of CASES) { const memory = new MemoryInsightHistory(); run(memory);
    withStore(store => { run(store);
      assert.deepEqual(store.getDaily(key), memory.getDaily(key), `daily: ${name}`);
      assert.deepEqual(store.sevenDays(series, '2026-10-12'), memory.sevenDays(series, '2026-10-12'), `7d: ${name}`);
      assert.deepEqual(store.previous(series, '2026-10-11'), memory.previous(series, '2026-10-11'), `prev: ${name}`); }); } });
