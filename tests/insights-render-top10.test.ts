import assert from 'node:assert/strict';
import test from 'node:test';
import { renderInsights } from '../src/ui/cli/insights-render.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import type { InsightLetterView } from '../src/ui/cli/insights-view.js';
const view: InsightLetterView = { ok: true, sections: [
  { kind: 'metadata', title: 'AI 인사이트 레터', publicationDate: '2026-10-12', issuedAt: '2026-10-12T00:00:00Z' },
  { kind: 'summary', title: '요약', items: [{ text: '확인된 변화 없음', evidenceIds: [] }] }] };
const compact = () => renderTop10FromRecords({ publicationDate: '2026-10-12', failedSources: ['cognition'], records: [
  { modelId: 'orchestrator-a', value: 53.4, metric: 'artificial_analysis_intelligence_index' },
  { modelId: 'orchestrator-b', value: 52.7, metric: 'artificial_analysis_intelligence_index' },
  { modelId: 'worker-a', value: 81.6, metric: 'artificial_analysis_coding_index' },
  { modelId: 'worker-b', value: 78.3, metric: 'artificial_analysis_coding_index' }] });
test('composition-injected compact renderer is used by default and stays under 3000 characters', () => {
  const rendered = renderInsights(view, { compact });
  assert.equal(rendered.exitCode, 0);
  assert.match(rendered.stdout, /오케스트레이터 Top10/);
  assert.match(rendered.stdout, /워커 Top10/);
  assert.ok(rendered.stdout.length <= 3000, `length=${rendered.stdout.length}`);
  assert.match(rendered.stdout, /출처: lmarena-ai LMArena Leaderboard Dataset \(CC-BY-4\.0\)/);
  assert.match(rendered.stdout, /출처: OpenRouter \(CC-BY-4\.0\)/); assert.match(rendered.stdout, /출처: Artificial Analysis \(라이선스 미확인\)/);
  assert.match(rendered.stdout, /출처: Cognition FrontierCode \(라이선스 미확인 · 내부 전용\)/);
  assert.match(rendered.stdout, /수집 실패 소스: cognition/);
  assert.match(rendered.stdout, /SQLite/);
  assert.equal((rendered.stdout.match(/^- /gm) ?? []).length, 3, 'the contract summary is three fact lines');
  assert.match(rendered.stdout, /^## 요약$/m);
});
test('--full and the legacy boolean keep the detailed letter instead of the compact one', () => {
  for (const options of [{ pretty: true, full: true }, true] as const) {
    const rendered = renderInsights({ ok: true, sections: [
      { kind: 'metadata', title: 'AI 인사이트 레터', publicationDate: '2026-10-12', issuedAt: '2026-10-12T00:00:00Z' },
    ] }, options);
    assert.match(rendered.stdout, /【AI 인사이트 레터】/);
    assert.doesNotMatch(rendered.stdout, /오케스트레이터 Top10/);
  }
  assert.match(renderInsights(view, {}).stdout, /\[AI 인사이트 레터\]/, 'no-injection fallback stays detailed');
});
test('a failed letter keeps the legacy failure contract in both modes', () => {
  const failed: InsightLetterView = { ok: false, reason: '전체 소스 실패', failedSources: ['arena'] };
  for (const options of [{ compact }, { full: true }]) {
    const rendered = renderInsights(failed, options);
    assert.equal(rendered.exitCode, 1); assert.equal(rendered.stdout, '');
    assert.match(rendered.stderr, /인사이트: 전체 소스 실패/);
  }
});
test('compact text strips control characters and credential-like fragments', () => {
  const text = renderTop10FromRecords({ publicationDate: '2026-10-12', records: [
    { modelId: 'bad\u001b[31m-model sk-live123456', value: 90, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'plain', value: 80, metric: 'artificial_analysis_coding_index' }] });
  assert.doesNotMatch(text, /\u001b/);
  assert.doesNotMatch(text, /sk-live123456/);
  assert.match(text, /\[redacted\]/);
});
test('normalize collisions omit the ambiguous reference rank instead of guessing', () => {
  const text = renderTop10FromRecords({ publicationDate: '2026-10-12',
    records: [{ modelId: 'acme/model-a', value: 90, metric: 'artificial_analysis_intelligence_index' }],
    arenaRecords: [{ modelId: 'acme/model-a', value: 1500, metric: 'rating' },
      { modelId: 'other/model-a', value: 1400, metric: 'rating' }] });
  assert.doesNotMatch(text, /Arena \d/);
});
test('worst-case compact stays within 3000 chars with long names, full turnover and long failures', () => {
  const longId = (i: number) => `provider/${'x'.repeat(100)}-model-${i}`;
  const records = [...Array.from({ length: 20 }, (_, i) => ({ modelId: longId(i), value: 90 - i,
      metric: 'artificial_analysis_intelligence_index' })),
    ...Array.from({ length: 20 }, (_, i) => ({ modelId: longId(100 + i), value: 80 - i,
      metric: 'artificial_analysis_coding_index' }))];
  const previousRanks = Array.from({ length: 10 }, (_, i) => ({ modelId: `prev-${i}`, rank: i + 1 }));
  const refs = Array.from({ length: 20 }, (_, i) => ({ modelId: longId(i), rank: i + 1 }));
  const text = renderTop10FromRecords({ publicationDate: '2026-10-12', records, arenaRecords: refs, openrouterRecords: refs, previousRanks,
    failedSources: Array.from({ length: 12 }, (_, i) => `source-with-a-very-long-name-${i}`) });
  assert.ok(text.length <= 3000, `length=${text.length}`);
  assert.match(text, /출처:/); assert.match(text, /SQLite/);
});
test('Arena reference uses the official rank field, not a rating re-sort', () => {
  const text = renderTop10FromRecords({ publicationDate: '2026-10-12',
    records: [{ modelId: 'A', value: 60, metric: 'artificial_analysis_intelligence_index' },
      { modelId: 'B', value: 50, metric: 'artificial_analysis_intelligence_index' }],
    arenaRecords: [{ modelId: 'A', rank: 2, metric: 'rank' }, { modelId: 'B', rank: 1, metric: 'rank' }] });
  assert.match(text, /B \(50\.0, Arena 1위\)/);
  assert.match(text, /A \(60\.0, Arena 2위\)/);
  const malformed = renderTop10FromRecords({ publicationDate: '2026-10-12',
    records: [{ modelId: 'm', value: 90, metric: 'artificial_analysis_intelligence_index' }],
    arenaRecords: [{ modelId: 'bad', value: Number.NaN, metric: 'rating' }] });
  assert.doesNotMatch(malformed, /Arena \d/);
});
test('previous cohort maps do not bypass metric separation when ranks are present', () => {
  const text = renderTop10FromRecords({ publicationDate: '2026-10-12',
    records: [{ modelId: 'm1', value: 90, metric: 'artificial_analysis_intelligence_index' },
      { modelId: 'm2', value: 80, metric: 'artificial_analysis_coding_index' }],
    previousRanks: [{ modelId: 'm1', rank: 1, metric: 'artificial_analysis_coding_index' },
      { modelId: 'm2', rank: 2, metric: 'artificial_analysis_coding_index' }] });
  assert.match(text, /m1 \(90\.0\) 신규/);
});
test('compact mode still reports failures diagnostics on stderr like the legacy contract', () => {
  const failing: InsightLetterView = { ok: true, sections: [
    { kind: 'metadata', title: 'AI 인사이트 레터', publicationDate: '2026-10-12', issuedAt: '2026-10-12T00:00:00Z' },
    { kind: 'failures', title: '실패', entries: [{ source: 'cognition', reason: '수집 실패' }] }] };
  const rendered = renderInsights(failing, { compact: () => '. ' });
  assert.match(rendered.stderr, /인사이트: Cognition: 수집 실패/);
});
