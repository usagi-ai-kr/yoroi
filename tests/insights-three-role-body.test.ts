import assert from 'node:assert/strict';
import test from 'node:test';
import { hasLegacyRoleBlocks, replaceLegacyRoleBlocks } from '../src/insights/letter-three-role-body.js';
import { buildThreeRole } from '../src/composition/insights-three-role.js';
import type { InsightRunResult } from '../src/insights/run-once.js';

const sections = { orchestrator: '## O', reviewer: '## R', worker: '## W' };
const body = ['# t', '', '## 🧭 오케스트레이터·리뷰어 Top7', '', 'a', '',
  '## 🛠️ 워커·메신저 Top7', '', 'b', '', '## 📖 표시 안내', '- 0~100 차원', '- ▽ 하한', '', 'note'].join('\n');

test('역할 블록 교체와 함께 2역할 안내가 3역할 안내로 바뀐다', () => {
  const out = replaceLegacyRoleBlocks(body, sections);
  assert.equal(hasLegacyRoleBlocks(out), false);
  assert.ok(!out.includes('0~100 차원') && !out.includes('▽ 하한'), '낡은 안내 제거');
  assert.ok(out.includes('- 👍 파레토 최적'), '3역할 안내 삽입');
  assert.ok(out.includes('## O') && out.includes('note'), '섹션 교체 + 뒤 내용 보존');
});

test('3역할 섹션의 usagi 각주(Free id 포함)는 교체 후에도 그대로 남는다', () => {
  const withFootnote = { orchestrator: '## O\n\n> deepseek-v4-1-flash: usagi ○ · 문서·계약 검토에 도움.',
    reviewer: '## R', worker: '## W\n\n> minimax-m3-1-flash: usagi △ · 표본이 적어 위험한 단위에는 쓰지 않음.' };
  const out = replaceLegacyRoleBlocks(body, withFootnote);
  assert.ok(out.includes('> deepseek-v4-1-flash: usagi ○ · 문서·계약 검토에 도움.'), '오케 각주 보존');
  assert.ok(out.includes('> minimax-m3-1-flash: usagi △ · 표본이 적어 위험한 단위에는 쓰지 않음.'), '워커 각주 보존');
  assert.ok(!out.includes('0~100 차원'), '2역할 전용 안내는 계속 제거');
});

test('4섹션 교체와 메신저 생략', () => {
  const out4 = replaceLegacyRoleBlocks(body, { ...sections, messenger: '## M' });
  const at = (h: string) => out4.indexOf(h);
  assert.ok(at('## O') < at('## R') && at('## R') < at('## W') && at('## W') < at('## M'), 'o→r→w→m');
  assert.equal(hasLegacyRoleBlocks(out4), false);
  const out3 = replaceLegacyRoleBlocks(body, sections);
  assert.ok(!out3.includes('## M') && out3.includes('## W'), '메신저 없으면 3섹션만');
});

const INTEL = 'artificial_analysis_intelligence_index', TPS = 'median_output_tokens_per_second', CPT = 'intelligence_index_cost_per_task';
const entry = (modelId: string) => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-14', verified: true });
const catalog = [{ planId: 'c', planName: 'C', models: ['mm-a', 'mm-b'].map(entry) }];
const recs = [
  { modelId: 'mm-a', metric: INTEL, value: 80 }, { modelId: 'mm-a', metric: TPS, value: 200 }, { modelId: 'mm-a', metric: CPT, value: 0.5 },
  { modelId: 'mm-b', metric: INTEL, value: 60 }, { modelId: 'mm-b', metric: TPS, value: 100 }, { modelId: 'mm-b', metric: CPT, value: 0.5 }];
const run = { top10: { records: recs, catalog, openrouterRecords: [], failedSources: [], previousRanks: [] } } as unknown as InsightRunResult;

test('composition은 computeRoleList로 메신저 목록을 만들고 pool을 보존한다', () => {
  const out = buildThreeRole(true, run)!;
  assert.deepEqual(out.selection?.messenger?.all.map(c => c.modelId).sort(), ['mm-a', 'mm-b']);
  assert.deepEqual((out.messengerPool ?? []).map(c => c.modelId).sort(), ['mm-a', 'mm-b'], '컷 전 전체 eligible');
  assert.ok(out.sections?.messenger?.includes('✉️ 메신저'), '섹션 생성');
  assert.ok(out.markdown?.includes('✉️ 메신저 Top7'), '본문 포함');
});

test('명시적 messenger 입력이 계산 목록보다 우선하고, 비어 있으면 생략·꺼지면 undefined', () => {
  const custom = buildThreeRole({ messenger: [{ modelId: 'custom-m' }] }, run)!;
  assert.deepEqual(custom.selection?.messenger?.all.map(c => c.modelId), ['custom-m'], '명시적 우선');
  assert.ok(custom.sections?.messenger?.includes('custom-m'));
  const emptyRun = { top10: { records: [], catalog, openrouterRecords: [], failedSources: [], previousRanks: [] } } as unknown as InsightRunResult;
  const empty = buildThreeRole(true, emptyRun)!;
  assert.equal(empty.sections?.messenger, undefined, '후보 없으면 섹션 생략');
  assert.ok(!empty.markdown?.includes('✉️ 메신저'));
  assert.equal(buildThreeRole(false, run), undefined, '비활성은 undefined(2역할 출력 불변)');
  assert.equal(buildThreeRole(undefined, run), undefined);
});
