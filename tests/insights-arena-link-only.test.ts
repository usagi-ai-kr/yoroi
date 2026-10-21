import assert from 'node:assert/strict';
import test from 'node:test';
import { ARENA_REFERENCE_LINE, SOURCE_LINES } from '../src/insights/letter-markdown-format.js';
import { renderLetterPartsFromRecords } from '../src/insights/letter-markdown.js';
import { replaceLegacyRoleBlocks } from '../src/insights/letter-three-role-body.js';

/** #226: Agent Arena 링크-only 참고. 자동 수집·점수 반영 없음. */
const RECORDS = [{ modelId: 'm1', metric: 'artificial_analysis_intelligence_index', value: 90, priceInput: 1, priceOutput: 2 },
  { modelId: 'm2', metric: 'artificial_analysis_intelligence_index', value: 80, priceInput: 1, priceOutput: 2 }];
const parts = () => renderLetterPartsFromRecords({ publicationDate: '2026-10-21', records: RECORDS });

test('details 에 참고 링크 1줄이 표시된다', () => {
  const { body } = parts();
  assert.ok(body.includes('### 참고'), '참고 블록');
  assert.ok(body.includes('https://arena.ai/leaderboard/agent'), '링크');
  assert.ok(body.includes('자동 수집·점수 미반영'), '미반영 명시');
  assert.equal(body.split('https://arena.ai/leaderboard/agent').length - 1, 1, '한 줄만');
  assert.ok(ARENA_REFERENCE_LINE.includes('2026-10-21 확인'), '확인일');
});

test('수집 출처 registry·sources 배지·출처 목록은 불변', () => {
  assert.ok(!SOURCE_LINES.some(line => line.includes('Agent Arena')), '수집 출처에 없음');
  const { body } = parts();
  assert.match(body, /sources-5_total-informational/, '배지 불변');
  const sources = body.slice(body.indexOf('### 출처'), body.indexOf('### 참고'));
  assert.ok(!sources.includes('Agent Arena'), '수집 출처 목록에 없음');
  assert.ok(sources.includes('출처: Artificial Analysis'), '기존 출처 유지');
});

test('본문 표·점수·순위는 불변(참고 줄이 추가될 뿐)', () => {
  const { body } = parts();
  const table = body.split('\n').filter(line => line.startsWith('|'));
  assert.ok(table.length > 0, '표 존재');
  assert.ok(table.every(line => !line.includes('arena.ai')), '표에는 링크 없음');
  const afterDetails = body.slice(body.indexOf('<details>'));
  assert.ok(afterDetails.includes('### 참고'), '링크는 details 내부');
  assert.ok(body.indexOf('https://arena.ai/leaderboard/agent') > body.indexOf('<details>'), '링크 위치');
});

test('2역할·3역할 레터 모두에 표시된다', () => {
  const { body } = parts();
  assert.ok(body.includes('### 참고'), '2역할 본문');
  const three = replaceLegacyRoleBlocks(body, { orchestrator: '## O', reviewer: '## R', worker: '## W' });
  assert.ok(three.includes('### 참고') && three.includes('https://arena.ai/leaderboard/agent'), '3역할 본문');
});
