import assert from 'node:assert/strict';
import test from 'node:test';
import { OPENCODE_DATA_FULL_REQUEST_SCOPE, parseOpenCodeDataJson } from '../src/insights/opencode-data-json-parser.js';

const AT = '2026-10-13T00:00:00Z';
const models = (base: number, count: number) => Object.fromEntries(
  Array.from({ length: count }, (_, i) => [`model-${String(i).padStart(2, '0')}`, base + i]));
const fixture = { page: 'x', summary: 'x', updatedAt: '2026-10-12T00:00:00Z',
  leaderboard: { pastWeek: [{ name: 'unparsed-key' }], pastDay: [] },
  dailyTokens: [
    { date: '2026-10-10', total: 600, models: models(100, 60) },
    { date: '2026-10-11', total: 300, models: { 'model-00': 200, 'model-01': 'x' } },
    { date: '2026-10-12', total: 150, models: { 'model-00': 150 } }] };

test('dailyTokens 전 날짜·전 모델을 컷 없이 저장한다(최신 날짜 전용 아님)', () => {
  const { rows, updatedAt } = parseOpenCodeDataJson(fixture, AT);
  assert.equal(updatedAt, '2026-10-12');
  const dates = rows.flatMap(r => (r.ok ? r.records.map(x => x.metadata?.date) : []));
  assert.deepEqual([...new Set(dates)].sort(), ['2026-10-10', '2026-10-11', '2026-10-12']);
  const first = rows.find(r => r.ok && r.records[0]?.metadata?.date === '2026-10-10');
  assert.equal(first?.ok && first.records.length, 60);
  const all = rows.flatMap(r => (r.ok ? r.records : []));
  const last = all.find(x => x.modelId === 'model-59');
  assert.equal(last?.value, 159);
  assert.equal(last?.metric, 'opencode_data_tokens');
  assert.equal(all.find(x => x.modelId === 'model-00' && x.metadata?.date === '2026-10-11')?.value, 200);
});

test('비수치 모델 항목은 날짜별 거절 행으로 집계되고 leaderboard는 파싱하지 않는다', () => {
  const { rows } = parseOpenCodeDataJson(fixture, AT);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.filter(r => !r.ok).map(r => r.reason), ['non-numeric-model-entries']);
  assert.ok(!JSON.stringify(rows).includes('unparsed-key'), 'leaderboard 내용은 파싱·노출되지 않는다');
});

test('전체 저장 scope는 기존 최신 날짜 scope와 구분되는 새 값이다', () => {
  assert.notEqual(OPENCODE_DATA_FULL_REQUEST_SCOPE, 'opencode-data:internal-daily');
  assert.ok(OPENCODE_DATA_FULL_REQUEST_SCOPE.endsWith(':all'));
});
