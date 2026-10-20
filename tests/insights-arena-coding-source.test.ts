import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArenaRowsUrl, fetchArenaCodingSubset } from '../src/insights/sources-arena-coding.js';
import { ARENA_CODING_RATING_METRIC, ARENA_CODING_SCORE_METRIC } from '../src/insights/arena-coding-types.js';

let autoIdx = 0;
const webRow = (id: string, rating: number, idx: number = autoIdx++) => ({
  row_idx: idx, row: { model_name: id, category: 'overall', rating, rank: 1, leaderboard_publish_date: '2026-10-16' },
});
const agentRow = (id: string, score: number, idx: number = autoIdx++) => ({
  row_idx: idx, row: { model_name: id, category: 'overall', score, rank: 1, leaderboard_publish_date: '2026-10-16' },
});

test('1. 2-page fixture pagination', async () => {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    const u = new URL(url), offset = Number(u.searchParams.get('offset'));
    if (offset === 0) return { rows: [webRow('Model A', 50), webRow('Model B', 52)], num_rows_total: 4 };
    return { rows: [webRow('Model C', 54), webRow('Model D', 56)], num_rows_total: 4 };
  };
  const res = await fetchArenaCodingSubset('webdev', { fetcher, pageLength: 2 });
  assert.equal(res.status, 'ok'); assert.equal(res.pages, 2); assert.equal(res.rows.length, 4);
  assert.deepEqual(res.rows.map(r => r.baseId), ['model-a', 'model-b', 'model-c', 'model-d']);
});

test('2. webdev vs agent subset metric', async () => {
  const fWeb = async () => ({ rows: [webRow('Claude (Max)', 63.3)], num_rows_total: 1 });
  const fAgent = async () => ({ rows: [agentRow('Grok (xHigh)', 0.14)], num_rows_total: 1 });
  const rWeb = await fetchArenaCodingSubset('webdev', { fetcher: fWeb });
  const rAgent = await fetchArenaCodingSubset('agent_bash_recovery_steps', { fetcher: fAgent });
  assert.equal(rWeb.rows[0]?.metric, ARENA_CODING_RATING_METRIC);
  assert.equal(rAgent.rows[0]?.metric, ARENA_CODING_SCORE_METRIC);
});

test('3. malformed row skipped without error', async () => {
  const fetcher = async () => ({ rows: [webRow('M1', 50), { row: { invalid: true } }, webRow('M2', 51)], num_rows_total: 3 });
  const res = await fetchArenaCodingSubset('webdev', { fetcher });
  assert.equal(res.status, 'ok'); assert.equal(res.rows.length, 2);
});

test('4. HTTP failure on first page and later page', async () => {
  const fFail1 = async () => { throw new Error('Network error'); };
  const r1 = await fetchArenaCodingSubset('webdev', { fetcher: fFail1 });
  assert.equal(r1.status, 'error'); assert.equal(r1.pages, 0); assert.equal(r1.rows.length, 0);

  const fFail2 = async (url: string) => {
    if (new URL(url).searchParams.get('offset') === '0') return { rows: [webRow('M1', 50)], num_rows_total: 2 };
    throw new Error('500 Server Error');
  };
  const r2 = await fetchArenaCodingSubset('webdev', { fetcher: fFail2, pageLength: 1 });
  assert.equal(r2.status, 'partial'); assert.equal(r2.pages, 1); assert.equal(r2.rows.length, 1);
});

test('5. partial/short page before total or flag', async () => {
  const fShort = async () => ({ rows: [webRow('M1', 50)], num_rows_total: 10 });
  const rShort = await fetchArenaCodingSubset('webdev', { fetcher: fShort, pageLength: 5 });
  assert.equal(rShort.status, 'partial'); assert.equal(rShort.partial, true);

  const fFlag = async () => ({ rows: [webRow('M1', 50)], num_rows_total: 1, partial: true });
  const rFlag = await fetchArenaCodingSubset('webdev', { fetcher: fFlag });
  assert.equal(rFlag.partial, true);
});

test('6. cap enforcement (maxPages and maxRows)', async () => {
  const fetcher = async (url: string) => {
    const o = Number(new URL(url).searchParams.get('offset'));
    return { rows: [webRow(`M${o}`, 50), webRow(`M${o + 1}`, 51)], num_rows_total: 20 };
  };
  const rPageCap = await fetchArenaCodingSubset('webdev', { fetcher, pageLength: 2, maxPages: 1 });
  assert.equal(rPageCap.pages, 1); assert.equal(rPageCap.status, 'partial');
  const rRowCap = await fetchArenaCodingSubset('webdev', { fetcher, pageLength: 2, maxRows: 3 });
  assert.equal(rRowCap.rows.length, 3); assert.equal(rRowCap.status, 'partial');
});

test('7. URL parameters correctly formatted', () => {
  const url = buildArenaRowsUrl({
    dataset: 'custom/repo', config: 'agent_bash_recovery_steps', split: 'train', offset: 20, length: 50,
  });
  const u = new URL(url);
  assert.equal(u.searchParams.get('dataset'), 'custom/repo');
  assert.equal(u.searchParams.get('config'), 'agent_bash_recovery_steps');
  assert.equal(u.searchParams.get('split'), 'train');
  assert.equal(u.searchParams.get('offset'), '20');
  assert.equal(u.searchParams.get('length'), '50');
});

test('8. dedupe repeated rows by row_idx across pages', async () => {
  const fetcher = async () => ({
    rows: [{ row_idx: 0, row: { model_name: 'Model A', category: 'overall', rating: 50 } }],
    num_rows_total: 2,
  });
  const res = await fetchArenaCodingSubset('webdev', { fetcher, pageLength: 1, maxPages: 2 });
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0]?.baseId, 'model-a');
});
