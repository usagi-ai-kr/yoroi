import assert from 'node:assert/strict';
import test from 'node:test';
import { EXCLUSION_NOTE } from '../src/insights/top10-policy.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';

/** 요금제상 최적 제거로 삭제된 insights-markdown-plan.test.ts의 공유 문구 커버리지 이관:
 *  압축 렌더가 마크다운과 동일한 EXCLUSION_NOTE를 출력한다. */
test('the compact render prints the shared exclusion note like the markdown letter', () => {
  const text = renderTop10FromRecords({ publicationDate: '2026-10-12',
    records: [{ modelId: 'claude-opus-5-5', value: 90, metric: 'artificial_analysis_intelligence_index', priceInput: 1, priceOutput: 2 }] });
  assert.ok(text.includes(EXCLUSION_NOTE), text);
});
