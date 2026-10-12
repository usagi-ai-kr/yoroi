import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { validateInsightRecord, validateInsightRows } from '../src/insights/validation.js';
import { isOpenCodeDataBlockedPage, parseOpenCodeDataPage } from '../src/insights/opencode-data-parser.js';
import { parseOpenCodeDataJson } from '../src/insights/opencode-data-json-parser.js';
import { fetchOpenCodeData, readOpenCodeDataReference, OPEN_CODE_DATA_SCOPE, OPEN_CODE_DATA_SCHEMA,
  OPEN_CODE_DATA_USER_AGENT } from '../src/insights/sources-opencode-data.js';

const observedAt = '2026-10-12T00:00:00Z';
const HTML = `<html><head><meta property="article:modified_time" content="2026-10-12"></head><body>
<table><tr><th>Model</th><th>Rank</th><th>Tokens</th><th>Share</th></tr>
<tr><td>model-a</td><td>1</td><td>1.2M</td><td>55%</td></tr>
<tr><td>model-b</td><td>2</td><td>800K</td><td>30%</td></tr></table>
<p>Updated: Oct 12, 2026</p></body></html>`;
/** 기록한 키 구조 그대로 만든 합성 fixture(실제 값 아님): root{updatedAt, dailyTokens[{date,total,models}]}. */
const jsonFixture = { page: 'x', summary: 'x', updatedAt: '2026-10-12T00:00:00Z',
  leaderboard: { pastWeek: [], pastDay: [] },
  dailyTokens: [{ date: '2026-10-11', total: 300, models: { 'model-a': 200, 'model-b': 100 } },
    { date: '2026-10-12', total: 120, models: { 'model-a': 100, 'model-b': -5, 'bad': 'x' } }] };

test('HTML fallback parser keeps rank/tokens/share and counts unusable rows as rejected', () => {
  const rows = parseOpenCodeDataPage(HTML, observedAt);
  assert.equal(rows.length, 2);
  const first = rows[0]!; assert.ok(first.ok);
  if (!first.ok) return;
  assert.deepEqual(first.records.map(r => [r.metric, r.value, r.unit]), [
    ['opencode_data_rank', 1, 'rank'], ['opencode_data_tokens', 1_200_000, 'tokens'], ['opencode_data_share', 55, 'percent']]);
  const numeric = `<table><tr><th>Model</th><th>Rank</th></tr><tr><td>GPT-5</td><td>1</td></tr><tr><td></td><td>2</td></tr></table>`;
  const mixed = parseOpenCodeDataPage(numeric, observedAt);
  assert.deepEqual(mixed.map(r => [r.ok, r.ok ? r.records[0]!.modelId : r.reason]), [[true, 'GPT-5'], [false, 'invalid-row']]);
  const validation = validateInsightRows('opencode-data', mixed);
  assert.ok(validation.ok); assert.equal(validation.rejectedRows, 1);
});
test('body date fallback parses in UTC regardless of the local timezone', () => {
  const script = "import('./src/insights/opencode-data-parser.js').then(m=>process.stdout.write(String(m.extractUpdatedAt('<p>Updated: Oct 12, 2026</p>')+' '+m.extractUpdatedAt('<p>Updated: 2026-10-12</p>'))))";
  const run = (tz: string) => execFileSync(process.execPath, ['--import', 'tsx', '-e', script], { cwd: process.cwd(), env: { ...process.env, TZ: tz }, encoding: 'utf8' });
  assert.equal(run('Asia/Seoul'), '2026-10-12 2026-10-12');
  assert.equal(run('UTC'), '2026-10-12 2026-10-12');
});
test('JSON parser reads only the recorded keys: latest dailyTokens date, finite model numbers, rejected rows counted', () => {
  const { rows, updatedAt } = parseOpenCodeDataJson(jsonFixture, observedAt);
  assert.equal(updatedAt, '2026-10-12');
  const ok = rows.filter(r => r.ok); assert.equal(ok.length, 1); // 최신 날짜(10-12)만
  if (!ok[0]!.ok) return;
  assert.deepEqual(ok[0]!.records.map(r => [r.modelId, r.value, r.metric, r.unit]), [
    ['model-a', 100, 'opencode_data_tokens', 'tokens']]); // -5·문자열 값 제외, 리더보드 미파싱
  assert.equal(ok[0]!.records[0]!.metadata?.updatedAt, '2026-10-12');
  const broken = parseOpenCodeDataJson({ updatedAt: 'not-a-date', dailyTokens: [{ nope: 1 }] }, observedAt);
  assert.equal(broken.updatedAt, null);
  assert.ok(broken.rows.every(r => !r.ok)); // 구조 불일치 행은 거부로 집계
});
test('production fetch is one JSON request with the contact UA; HTTP errors stop without retry', async () => {
  let seen = '', urls: string[] = [];
  const ok = await fetchOpenCodeData({ transport: async (url, headers) => { urls.push(url); seen = headers['User-Agent'] ?? ''; return { status: 200, body: JSON.stringify(jsonFixture) }; } });
  assert.deepEqual([ok.requests, urls.length, ok.jsonText.length > 0], [1, 1, true]);
  assert.match(urls[0]!, /^https:\/\/opencode\.ai\/data\/index\.json$/);
  assert.equal(seen, OPEN_CODE_DATA_USER_AGENT);
  for (const [status, code] of [[429, 'unavailable'], [403, 'authentication'], [500, 'unavailable']] as const) {
    let calls = 0;
    await assert.rejects(fetchOpenCodeData({ transport: async () => { calls++; return { status, body: '' }; } }),
      (error: SourceError) => error.code === code);
    assert.equal(calls, 1);
  }
  assert.equal(isOpenCodeDataBlockedPage('<title>Just a moment...</title>'), true);
});
test('the reference lookup reads the stored daily row', () => {
  const history = new MemoryInsightHistory();
  const parsed = parseOpenCodeDataJson(jsonFixture, observedAt);
  history.saveDaily({ source: 'opencode-data', publicationDate: '2026-10-12', requestScope: OPEN_CODE_DATA_SCOPE,
    schemaVersion: OPEN_CODE_DATA_SCHEMA }, { ok: true, source: 'opencode-data', rejectedRows: 0,
    records: parsed.rows.flatMap(r => r.ok ? r.records : []).map(rec => { const v = validateInsightRecord(rec); assert.ok(v.ok); return v.value; }) });
  assert.equal(readOpenCodeDataReference(history, '2026-10-12')?.records.length, 1);
});
test('a 200 HTML challenge or non-JSON content type is unavailable with one attempt', async () => {
  await assert.rejects(fetchOpenCodeData({ transport: async () => ({ status: 200, body: '<!doctype html><title>Just a moment...</title>' }) }),
    (error: SourceError) => error.code === 'unavailable');
  let calls = 0;
  await assert.rejects(fetchOpenCodeData({ transport: async () => { calls++; return { status: 200, body: '{"a":1}', contentType: 'text/html' }; } }),
    (error: SourceError) => error.code === 'unavailable');
  assert.equal(calls, 1);
  const page = await fetchOpenCodeData({ transport: async () => ({ status: 200, body: JSON.stringify(jsonFixture) }) });
  assert.equal(page.requests, 1);
});
test('mixed numeric and non-numeric model entries count as rejected rows instead of vanishing', () => {
  const payload = { updatedAt: '2026-10-12T00:00:00Z',
    dailyTokens: [{ date: '2026-10-12', total: 7, models: { 'model-a': 7, 'model-b': 'x', 'model-c': null } }] };
  const rows = parseOpenCodeDataJson(payload, observedAt).rows;
  assert.deepEqual(rows.map(r => [r.ok, r.ok ? 'ok' : r.reason]), [[true, 'ok'], [false, 'non-numeric-model-entries']]);
  const validation = validateInsightRows('opencode-data', rows);
  assert.ok(validation.ok); assert.equal(validation.rejectedRows, 1);
});
