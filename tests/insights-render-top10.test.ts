import assert from 'node:assert/strict';
import test from 'node:test';
import { renderInsights } from '../src/ui/cli/insights-render.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import type { InsightLetterView } from '../src/ui/cli/insights-view.js';
const view: InsightLetterView = { ok: true, sections: [
  { kind: 'metadata', title: 'AI 인사이트 레터', publicationDate: '2026-10-12', issuedAt: '2026-10-12T00:00:00Z' },
  { kind: 'summary', title: '요약', items: [{ text: '확인된 변화 없음', evidenceIds: [] }] }] };
const compact = () => renderTop10FromRecords({ publicationDate: '2026-10-12', failedSources: ['cognition'], records: [
  { modelId: 'gpt-6-1-sol', value: 85.0, metric: 'artificial_analysis_intelligence_index' },
  { modelId: 'claude-opus-5-5', value: 90.0, metric: 'artificial_analysis_intelligence_index' },
  { modelId: 'gpt-6-1-sol', value: 82.0, metric: 'artificial_analysis_coding_index' },
  { modelId: 'claude-opus-5-5', value: 88.0, metric: 'artificial_analysis_coding_index' }] });
test('composition-injected compact renderer is used by default and stays under the 3600-char budget', () => {
  const rendered = renderInsights(view, { compact });
  assert.equal(rendered.exitCode, 0);
  assert.match(rendered.stdout, /## 🧭 오케스트레이터·리뷰어 Top10/);
  assert.match(rendered.stdout, /## 🛠️ 워커·메신저 Top10/);
  assert.ok(rendered.stdout.length <= 3600, `length=${rendered.stdout.length}`);
  assert.match(rendered.stdout, /^## 요약$/m);
  assert.match(rendered.stdout, /출처: OpenRouter \(CC-BY-4\.0\)/); assert.match(rendered.stdout, /출처: Artificial Analysis \(라이선스 미상\)/); assert.match(rendered.stdout, /출처: OpenCode Data \(내부 참조 · 약관상 자동 추출 제한\) \(라이선스 미상\)/);
  assert.match(rendered.stdout, /출처: Cognition FrontierCode \(라이선스 미상 · 내부 전용\)/); assert.match(rendered.stdout, /수집 실패 소스: cognition/);
  assert.match(rendered.stdout, /SQLite/); assert.doesNotMatch(rendered.stdout, /가중치 재정규화/);
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
  const failed: InsightLetterView = { ok: false, reason: '전체 소스 실패', failedSources: ['openrouter'] };
  for (const options of [{ compact }, { full: true }]) {
    const rendered = renderInsights(failed, options);
    assert.equal(rendered.exitCode, 1); assert.equal(rendered.stdout, '');
    assert.match(rendered.stderr, /인사이트: 전체 소스 실패/);
  }
});
test('compact text strips control characters and credential-like fragments', () => {
  const text = renderTop10FromRecords({ publicationDate: '2026-10-12', records: [
    { modelId: 'gpt-6-1-sol', value: 90, metric: 'artificial_analysis_intelligence_index\u001b[31m sk-live123456' }] });
  assert.doesNotMatch(text, /\u001b/);
  assert.doesNotMatch(text, /sk-live123456/);
});
test('worst-case compact stays within the 3800-char budget with long names, full turnover and long failures', () => {
  const catalogModels = ['gpt-6-1-sol', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'gemini-3-1-pro',
    'gemini-3-pro', 'deepseek-v4-1-flash', 'gemma4', 'glm-5-3', 'glm-5-3-flash'];
  const records = catalogModels.flatMap((m, i) => [
    { modelId: m, value: 90 - i, metric: 'artificial_analysis_intelligence_index' },
    { modelId: m, value: 90 - i, metric: 'artificial_analysis_coding_index' }]);
  const previousRanks = Array.from({ length: 10 }, (_, i) => ({ modelId: `prev-${i}`, rank: i + 1 }));
  const refs = catalogModels.map((m, i) => ({ modelId: m, rank: i + 1 }));
  const text = renderTop10FromRecords({ publicationDate: '2026-10-12', records, openrouterRecords: refs, previousRanks,
    failedSources: Array.from({ length: 12 }, (_, i) => `source-with-a-very-long-name-${i}`) });
  assert.ok(text.length <= 3800, `length=${text.length}`);
  assert.match(text, /출처:/); assert.match(text, /SQLite/);
});
test('previous cohort maps track rank changes in both role lists', () => {
  const text = renderTop10FromRecords({ publicationDate: '2026-10-12',
    records: [{ modelId: 'gpt-6-1-sol', value: 90, metric: 'artificial_analysis_intelligence_index' },
      { modelId: 'claude-opus-5-5', value: 80, metric: 'artificial_analysis_coding_index' }],
    cognitionRecords: [{ modelId: 'claude-opus-5-5', value: 0.8, metric: 'cognition_correct' }],
    previousRanks: [{ modelId: 'gpt-6-1-sol', rank: 1, metric: 'rank' },
      { modelId: 'claude-opus-5-5', rank: 2, metric: 'rank' }] });
  // 오케: GPT(AA 1)=50, Opus(Cog 1)=50 동점 → 모델명순 Opus 1위. 전일 GPT 1·Opus 2 → Opus ▲1, GPT ▼1.
  assert.match(text, /gpt-6-1-sol .*▼1/);
  assert.match(text, /claude-opus-5-5 .*▲1/);
});
test('compact mode still reports failures diagnostics on stderr like the legacy contract', () => {
  const failing: InsightLetterView = { ok: true, sections: [
    { kind: 'metadata', title: 'AI 인사이트 레터', publicationDate: '2026-10-12', issuedAt: '2026-10-12T00:00:00Z' },
    { kind: 'failures', title: '실패', entries: [{ source: 'cognition', reason: '수집 실패' }] }] };
  const rendered = renderInsights(failing, { compact: () => '. ' });
  assert.match(rendered.stderr, /인사이트: Cognition: 수집 실패/);
});
test('OpenRouter usage ranks stay 1..N and raw total_tokens never reach the letter (ref-rank-113)', () => {
  const text = renderTop10FromRecords({ publicationDate: '2026-10-12', records: [{ modelId: 'gpt-6-1-sol', value: 51.8, priceInput: 1, priceOutput: 1, metric: 'artificial_analysis_intelligence_index' }], openrouterRecords: [{ modelId: 'gpt-6-1-sol', value: 264308530787, metric: 'total_tokens' }] });
  assert.match(text, /OpenRouter 1위/); assert.ok(!text.includes('264308530787'), text);
});
