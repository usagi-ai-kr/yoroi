import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTop10Markdown, renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import { MARKDOWN_LIMIT, OMISSION_MARK, truncateAtRowBoundary } from '../src/insights/letter-markdown-format.js';
import { INSIGHT_SOURCES } from '../src/insights/sources.js';

const empty = { orchestrator: { entries: [], exits: [] }, worker: { entries: [], exits: [] } };

test('partial sources and warnings reach the markdown instead of all_healthy', () => {
  const md = renderTop10Markdown({ publicationDate: '2026-10-12', lists: empty,
    partialSources: ['artificial-analysis'], notes: ['전일 OpenRouter 자료 없음'] });
  assert.ok(!md.includes('all_healthy'));
  assert.ok(md.includes('partial'));
  assert.ok(md.includes('부분 수집 소스: artificial-analysis'));
  assert.ok(md.includes('전일 OpenRouter 자료 없음'));
  assert.ok(!md.includes('모든 소스 정상 수집 완료'));
});

test('failed and partial together report both, failures first', () => {
  const md = renderTop10Markdown({ publicationDate: '2026-10-12', lists: empty,
    failedSources: ['cognition'], partialSources: ['artificial-analysis'], notes: ['샘플 정체 경고'] });
  assert.ok(md.includes('1_failed-critical'));
  assert.ok(md.includes('⚠️ cognition'));
  assert.ok(md.includes('부분 수집 소스: artificial-analysis'));
  assert.ok(md.includes('샘플 정체 경고'));
});

test('clean input still reports all healthy without partial markers', () => {
  const md = renderTop10Markdown({ publicationDate: '2026-10-12', lists: empty });
  assert.ok(md.includes('all_healthy-success'));
  assert.ok(md.includes('모든 소스 정상 수집 완료'));
});

test('sources badge and attribution list follow the INSIGHT_SOURCES registry', () => {
  const md = renderTop10Markdown({ publicationDate: '2026-10-12', lists: empty });
  assert.ok(md.includes(`sources-${INSIGHT_SOURCES.length}_total`));
  for (const entry of INSIGHT_SOURCES) assert.ok(md.includes(entry.displayName), entry.id);
  assert.ok(md.includes('약관상 자동 추출 제한'));
});

test('records path forwards partialSources and notes into the markdown', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-12', records: [],
    partialSources: ['arena'], notes: ['전일 Arena 자료 없음'] });
  assert.ok(md.includes('부분 수집 소스: arena'));
  assert.ok(md.includes('전일 Arena 자료 없음'));
  assert.ok(!md.includes('all_healthy'));
});

test('overflow cuts at a row boundary with the omission mark and keeps code points intact', () => {
  const line = '| ' + '가'.repeat(50) + ' |';
  const long = Array.from({ length: 1500 }, () => line).join('\n');
  const result = truncateAtRowBoundary(long);
  assert.ok([...result].length <= MARKDOWN_LIMIT);
  assert.ok(result.includes(OMISSION_MARK));
  assert.ok(!result.includes('--full`' + '\n' + '|'));
  const lines = result.split('\n');
  assert.ok(!lines.slice(0, -1).some(l => l.length > 0 && !l.startsWith('| ')));
  const pair = '😀'.repeat(70000);
  const bounded = truncateAtRowBoundary(pair);
  assert.equal([...bounded].length, OMISSION_MARK.length + 2 + MARKDOWN_LIMIT);
  const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  assert.ok(!lone.test(bounded));
  assert.equal(truncateAtRowBoundary('짧은 본문'), '짧은 본문');
});
