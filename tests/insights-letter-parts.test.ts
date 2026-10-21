import assert from 'node:assert/strict';
import test from 'node:test';
import { joinLetterParts, renderLetterPartsFromRecords } from '../src/insights/letter-markdown.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const INTEL = 'artificial_analysis_intelligence_index';
const MODELS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10'];
const catalogFor = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 't', planName: 'T',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-16', verified: true })) }];
const FREE_CATALOG: readonly PlanCatalogEntry[] = [{ planId: 'f', planName: 'F', tier: 'free',
  models: [{ modelId: 'free-m', displayName: 'free-m', sourceUrl: 'https://example.test', checkedOn: '2026-10-16', verified: true }] }];
const records = MODELS.map((modelId, i) => ({ modelId, value: 100 - i, metric: INTEL, priceInput: 1, priceOutput: 1 }));
const previousRanks = [{ modelId: 'old-model', rank: 1, metric: 'rank' }];
const parts = () => renderLetterPartsFromRecords({ publicationDate: '2026-10-12', records,
  previousRanks, catalog: catalogFor(MODELS), freeCatalog: FREE_CATALOG });

const tableRows = (table: string): string[] =>
  table.split('\n').filter(line => /^\| (▽ )?\d+ \| /.test(line));

test('body holds 7 rows per role, comments hold the full Top15', () => {
  const { body, comments } = parts();
  assert.equal(comments.length, 3);
  for (const table of [body, comments[0]!, comments[1]!]) assert.ok(table.includes('| 순위 |'));
  assert.equal(tableRows(body).length, 14, 'body: 7 + 7');
  assert.ok(tableRows(comments[0]!).length <= 15 && tableRows(comments[1]!).length <= 15);
  assert.ok(!body.includes('## 🆓 Free 티어') && comments[2]!.includes('## 🆓 Free 티어'));
  assert.ok(!body.includes('🚪 이탈:') && (comments[0]! + comments[1]!).includes('🚪 이탈: old-model'));
});

test('body 1-7위와 댓글 앞 7행이 모델·순위·점수까지 같다', () => {
  const { body, comments } = parts();
  // 본문 Top7(파레토 열 없음)과 댓글 Top15(파레토 열 유지)는 열 구성이 다르므로 머리 기준으로 비교한다.
  const keyOf = (table: string, line: string): readonly [string, string, string] => {
    const head = (table.split('\n').find(l => l.startsWith('| 순위 |')) ?? '').split('|').map(c => c.trim());
    const cells = line.split('|').map(cell => cell.trim());
    return [cells[1]!.replace(/^▽ /, ''), cells[head.indexOf('모델')]!, cells[head.indexOf('스코어')]!];
  };
  assert.deepEqual(tableRows(body).slice(0, 7).map(l => keyOf(body, l)),
    tableRows(comments[0]!).slice(0, 7).map(l => keyOf(comments[0]!, l)));
});

test('joinLetterParts는 구분자로 body+댓글 3개를 순서대로 붙인다', () => {
  const joined = joinLetterParts(parts());
  assert.ok(joined.startsWith('# AI 인사이트 데일리: 2026-10-12 KST'));
  for (const n of [1, 2, 3]) assert.ok(joined.includes(`<!-- yoroi:comment ${n} -->`));
  assert.ok(joined.indexOf('<!-- yoroi:comment 1 -->') < joined.indexOf('<!-- yoroi:comment 2 -->'));
});

test('#230 U3b: 2역할 댓글은 3개 그대로이고 Free 섹션 문자열을 별도로 노출한다', () => {
  const { comments, freeSection } = parts();
  assert.equal(comments.length, 3, '2역할 댓글 3개 계약 유지');
  assert.equal(freeSection, comments[2], 'Free 섹션 = comments[2] 와 동일 문자열');
  assert.ok(freeSection!.includes('## 🆓 Free 티어'), 'Free 섹션 본문');
});
