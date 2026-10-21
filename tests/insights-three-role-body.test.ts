import assert from 'node:assert/strict';
import test from 'node:test';
import { hasLegacyRoleBlocks, replaceLegacyRoleBlocks } from '../src/insights/letter-three-role-body.js';
import { renderLetterPartsFromRecords } from '../src/insights/letter-markdown.js';
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

const oldBody = ['# t', '', '## 요약', '- 선두: 오케스트레이터·리뷰어 a · 워커·메신저 b', '',
  '## 🧭 오케스트레이터·리뷰어 Top7', '', 'a', '',
  '## 🛠️ 워커·메신저 Top7', '', 'b', '',
  '## 📖 표시 안내', '- 0~100 차원', '',
  '- 자격: 스코어 ≥ 후보 최고 스코어 × 85%(오케스트레이터·리뷰어)/60%(워커·메신저) 통과',
  '- 가중치: 오케·리뷰어 성능 75%·속도 10%·가성비 15% / 워커·메신저 성능 30%·사용량 20%·속도 10%·가격 40%', '', 'note'].join('\n');

test('U3c: 4역할 본문에서 워커 라벨이 분리되고 메신저 가중치 줄이 생긴다', () => {
  const out = replaceLegacyRoleBlocks(oldBody, { ...sections, messenger: '## ✉️ 메신저 Top7' });
  assert.ok(!out.includes('워커·메신저'), '구 라벨 잔재 없음');
  assert.ok(out.includes('## ✉️ 메신저 Top7'), '메신저 섹션');
  assert.ok(out.includes('- 선두: 오케스트레이터·리뷰어 a · 워커 b'), '요약 라벨 분리');
  assert.ok(out.includes('워커 성능 30%·사용량 20%·속도 10%·가격 40%'), '워커 가중치 유지');
  assert.ok(out.includes('- 가중치: 메신저 성능 20%·사용량 10%·속도 30%·가격 40% (워커와 같은 배관, 가중치만 상이)'), '메신저 가중치 줄');
  assert.ok(out.includes('60%(워커)/60%(메신저)'), '자격 메신저 병기');
});

test('U3c: 레거시 제목·2역할 외 본문은 손대지 않는다', () => {
  const keep = replaceLegacyRoleBlocks('# t\n\n## 🛠️ 워커·메신저 Top7\n\nb', sections);
  assert.ok(keep.includes('## 🛠️ 워커·메신저 Top7'), '레거시 제목 유지');
  assert.equal(hasLegacyRoleBlocks(keep), true);
});

test('#232: 2역할 레거시 표는 실사용 컬럼 없이 그대로, 3역할 표에는 있다', () => {
  const legacy = renderLetterPartsFromRecords({ publicationDate: '2026-10-21', records: [
    { modelId: 'm1', metric: 'artificial_analysis_intelligence_index', value: 90, priceInput: 1, priceOutput: 2 }] });
  assert.ok(!legacy.body.includes('| effort | 실사용 |'), '2역할 표 머리에는 실사용 컬럼 없음');
  assert.ok(!legacy.comments.some(c => c.includes('| effort | 실사용 |')), '2역할 댓글에도 없음');
  const out = replaceLegacyRoleBlocks(legacy.body, { ...sections, messenger: '## ✉️ 메신저 Top7' });
  assert.ok(out.includes('- 실사용 = usagi 정성 관찰 표식'), '3역할 안내에 실사용 설명');
  assert.ok(!out.includes('| effort | 실사용 |'), '레거시 표 머리에는 실사용 컬럼이 붙지 않음(3역할 표는 별도 렌더)');
});
