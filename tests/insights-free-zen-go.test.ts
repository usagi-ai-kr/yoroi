import assert from 'node:assert/strict';
import test from 'node:test';
import { freeListsFrom, renderFreeSectionCompact, renderFreeSectionMarkdown } from '../src/insights/letter-markdown-free.js';
import type { CalibrationRunRecord } from '../src/insights/calibration-store.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index';
const freeEntry = (modelId: string, displayName = modelId) => ({ modelId, displayName, sourceUrl: 'https://opencode.ai/v2/docs/console/models', checkedOn: '2026-10-13', verified: true });
const FREE_CATALOG: readonly PlanCatalogEntry[] = [
  { planId: 'opencode-zen-free', planName: 'OpenCode Zen Free', tier: 'free', models: [freeEntry('big-pickle', 'Big Pickle'), freeEntry('step-5', 'Step 5 Preview Free'), freeEntry('mimo-v2-5'), freeEntry('ling-3-0-flash-fin')] },
  { planId: 'opencode-go-free', planName: 'OpenCode Go Free', tier: 'free', models: [freeEntry('step-5', 'Step 5 Preview Free'), freeEntry('mimo-v2-5')] }];
const RECORDS = [
  { modelId: 'step-5', value: 45, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'big-pickle', value: 80, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'big-pickle', value: 85, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'mimo-v2-5', value: 70, metric: CODE, priceInput: 0.1, priceOutput: 0.4 },
  { modelId: 'ling-3-0-flash-fin', value: 60, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'claude-sonnet-5-5', value: 88, metric: INTEL, priceInput: 1, priceOutput: 5 }];

test('#196: Free 화면은 Zen·Go 체크만 쓰고 미확인 표기를 반복하지 않는다', () => {
  const lists = freeListsFrom(RECORDS, FREE_CATALOG, {})!;
  const md = renderFreeSectionMarkdown(lists, [], 5, () => undefined).join('\n');
  const compact = renderFreeSectionCompact(lists, [], 5).join('\n');
  const rows = md.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| 모델') && !line.startsWith('| ---'));
  assert.ok(rows.length > 0);
  assert.ok(rows.every(line => /^\| [^|]+ \| [^|]+ \| [^|]+ \| [^|]+ \| (✓|) \| (✓|) \|/.test(line)), 'Zen/Go 칸은 ✓ 또는 빈 칸만');
  assert.ok(!md.includes('미검증'), '미검증만 있는 작업 가능성 열은 화면에서 숨는다');
  assert.ok(!md.includes('(미확인)'), '미확인 effort 표기를 Free 화면에 반복하지 않는다');
  assert.ok(md.includes('빈 칸은 이 화면에서 확인되지 않음') && md.includes('사용 불가 확정이 아님'), '빈 칸은 사용 불가 확정이 아님을 밝힌다');
  // 정식 렌더와 댓글(compact)이 같은 접근 근거를 쓴다.
  const bothChecked = rows.filter(line => /\| ✓ \| ✓ \|/.test(line)).map(line => line.split('|')[1]!.trim());
  assert.ok(bothChecked.length > 0, 'Zen·Go 모두 확인된 행이 있다');
  for (const id of bothChecked) {
    const line = compact.split('\n').find(l => l.startsWith(`${id} · `));
    assert.ok(line && line.includes('Zen ✓ Go ✓'), `${id}: 댓글도 같은 근거를 쓴다`);
  }
});

test('capability supplement shows verdicts and falls back without a store (#180 unit 5)', () => {
  const cap = (modelId: string, verdict: CalibrationRunRecord['verdict'], totalScore: number, sampleStatus: CalibrationRunRecord['sampleStatus'], sampleCount: number): CalibrationRunRecord => ({ runId: `r-${modelId}`, modelId, taskSetVersion: 'v1', evaluatorVersion: 'v1', runAt: '2026-10-20T00:00:00.000Z', tasks: [], violationClasses: [], totalScore, verdict, sampleStatus, sampleCount });
  const byId = (m: Record<string, CalibrationRunRecord[]>) => (id: string) => m[id];
  const lists = freeListsFrom(RECORDS, FREE_CATALOG, {})!;
  const text = renderFreeSectionMarkdown(lists, [], 5, byId({ 'step-5': [cap('step-5', 'capable', 84, 'stable', 3)], 'big-pickle': [cap('big-pickle', 'assistant', 72, 'stable', 3)], 'mimo-v2-5': [cap('mimo-v2-5', 'not_recommended', 40, 'stable', 3)], 'ling-3-0-flash-fin': [cap('ling-3-0-flash-fin', 'capable', 90, 'provisional', 1)] })).join('\n');
  for (const s of ['작업 가능 · 84/100 · 3회 · task-set v1 · 2026-10-20', '보조 가능 · 72/100 · 3회 · task-set v1 · 2026-10-20', '권장하지 않음', '측정 부족 · 잠정 · 1회 · 2026-10-20']) assert.ok(text.includes(s), s);
  const none = renderFreeSectionMarkdown(lists, [], 5, () => undefined).join('\n');
  // #196: 미검증 반복을 보여주지 않는다 — 작업 가능성 열 자체를 숨긴다(내부 근거는 유지).
  assert.ok(!none.includes('| 미검증 |') && !none.includes('작업 가능 ·') && !none.includes('측정 부족'));
  assert.ok(!none.includes('작업 가능성'), '작업 가능성 열이 숨겨진다');
  assert.ok(none.includes('| 모델 | 오케 | 워커 | AA 지수 | Zen | Go | 비고 |'), '숨김 시에도 Zen/Go 표는 유지');
});
