import assert from 'node:assert/strict';
import test from 'node:test';
import { joinLetterParts, renderLetterPartsFromRecords, renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index';
const freeEntry = (modelId: string, displayName = modelId) => ({ modelId, displayName, sourceUrl: 'https://opencode.ai/v2/docs/console/models', checkedOn: '2026-10-13', verified: true });
const FREE_CATALOG: readonly PlanCatalogEntry[] = [
  { planId: 'opencode-zen-free', planName: 'OpenCode Zen Free', tier: 'free', models: [freeEntry('big-pickle', 'Big Pickle'), freeEntry('step-5', 'Step 5 Preview Free'), freeEntry('mimo-v2-5'), freeEntry('ling-3-0-flash-fin')] },
  { planId: 'opencode-go-free', planName: 'OpenCode Go Free', tier: 'free', models: [freeEntry('step-5', 'Step 5 Preview Free')] },
];
const RECORDS = [{ modelId: 'step-5', value: 90, metric: INTEL, priceInput: 1, priceOutput: 2 },
  { modelId: 'big-pickle', value: 80, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'big-pickle', value: 85, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'mimo-v2-5', value: 70, metric: CODE, priceInput: 0.1, priceOutput: 0.4 },
  { modelId: 'ling-3-0-flash-fin', value: 60, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'claude-sonnet-5-5', value: 88, metric: INTEL, priceInput: 1, priceOutput: 5 }];
test('the free section renders one merged table with notes limited to Zen/Go Free', () => {
  const section = renderLetterPartsFromRecords({ publicationDate: '2026-10-13', records: RECORDS, freeCatalog: FREE_CATALOG }).comments[2];
  assert.ok(!section.includes('### 오케스트레이터') && !section.includes('### 워커'), '한 표로 합쳐 소제목을 두지 않는다');
  assert.ok(section.includes('| 모델 | 오케 | 워커 | AA 지수 | Zen | Go | 비고 |'), 'Zen/Go 체크 열로 분리');
  assert.ok(!section.includes('Free 경로'), 'Free 경로 문자열 열은 제거');
  const rows = section.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| 모델') && !line.startsWith('| ---'));
  assert.ok(rows.length >= 3 && rows.some(line => /^\| [^|]+ \| ✓ [\d.]+ \| /.test(line)), '오케 통과 행은 ✓ 스코어를 쓴다');
  assert.ok(rows.every(line => /^\| [^|]+ \| (✓ [\d.]+|✗|-) \| (✓ [\d.]+|✗|-) \| (-|[\d.]+) \| (✓|) \| (✓|) \| .+ \|$/.test(line)), section);
  // #194: Free 표의 모델 열은 표시용으로 '-free' 접미사를 뺀다(내부 id 는 유지).
  assert.ok(rows.every(line => !line.split('|')[1]!.includes('-free')), 'Free 표 모델 열에 -free 접미사가 없다');
  // 표시 점수는 Free 포함 모집단 정규 순위: step-5 워커 43.3(raw 30.0). AA 지수는 indexText 90.0.
  assert.ok(rows.some(line => /^\| step-5 \| ✓ [\d.]+ \| ✓ 43\.3 \| 90\.0 \| /.test(line)), '표시 보정: step-5 워커 43.3');
  assert.ok(rows.filter(line => /^\| [^|]+ \| - \| - \| /.test(line)).every(line => line.includes('근거 없음')), '두 역할 -는 근거 없음 행에만');
  assert.ok(rows.some(line => /\| 90\.0 \|/.test(line)) && rows.some(line => /\| 80\.0 \|/.test(line)));
  assert.ok(rows.some(line => /\| ✓ \| ✓ \|/.test(line)), 'Zen·Go 모두 확인된 행은 양쪽 ✓');
  assert.ok(rows.some(line => /\| ✓ \| +\|/.test(line)), 'Zen만 확인된 행은 Go 빈 칸');
  assert.ok(section.includes('Zen = OpenCode Zen Free · Go = OpenCode Go Free'), '범례는 짧게');
  assert.ok(!section.includes('x-opencode-session'), '세션 헤더 문구는 발행본에 나타나지 않는다');
  assert.ok(section.includes('- OpenCode Zen Free: 기간 한정 무료') && section.includes('- OpenCode Go Free: Unlimited·기간 한정'));
  assert.ok(!section.includes('↔') && !section.includes('⭐') && !section.includes('Antigravity Free'));
  // #188: 가용성 표기(미확인 등)는 비고 칸까지 허용하고, 플랜 안내 문구(행 단락 텍스트)에는 나오지 않는다.
  assert.ok(section.split('\n').filter(l => l.startsWith('- ')).every(l => !l.includes('미확인')), '플랜 안내 문구에는 가용성 표기가 없다');
});
test('ranked free models outside the old top-5 cut still get rows (p78 2a)', () => {
  const models = ['alpha-zen', 'bravo-zen', 'charlie-zen', 'delta-zen', 'echo-zen', 'foxtrot-zen', 'golf-zen', 'hotel-zen'].map(id => freeEntry(id));
  const catalog: readonly PlanCatalogEntry[] = [{ planId: 'opencode-zen-free', planName: 'OpenCode Zen Free', tier: 'free', models }];
  const records = models.map((m, i) => ({ modelId: m.modelId, value: 90 - i * 5, metric: INTEL, priceInput: 1, priceOutput: 1 }));
  const section = renderLetterPartsFromRecords({ publicationDate: '2026-10-13', records, freeCatalog: catalog }).comments[2];
  const rows = section.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| 모델') && !line.startsWith('| ---'));
  assert.equal(rows.length, models.length, '상위 limit 밖 랭크 모델도 모두 행이 된다');
  assert.ok(rows.some(line => line.includes('| hotel-zen |')), '목록 최하위 모델도 행으로 남는다');
});
test('an absent freeCatalog yields the single collection-failure line', () => {
  for (const empty of [undefined, [] as readonly PlanCatalogEntry[]]) {
    const section = renderLetterPartsFromRecords({ publicationDate: '2026-10-13', records: RECORDS, ...(empty && { freeCatalog: empty }) }).comments[2];
    assert.ok(section.includes('Free 목록 수집 실패(opencode models)'));
    assert.ok(!section.includes('### 오케스트레이터'));
    assert.ok(renderTop10FromRecords({ publicationDate: '2026-10-13', records: RECORDS }).includes('Free 목록 수집 실패(opencode models)'));
  }
});
test('labels are plain: no successor note, no bracketed plan tails, no Cursor for third-party', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: RECORDS, freeCatalog: FREE_CATALOG });
  assert.ok(!md.includes('선행') && !md.includes('(크레딧'), 'successor/credit annotation removed');
  assert.ok(!md.includes('440회') && !md.includes('API 정가'), 'limit tail/cursor label removed');
  assert.ok(!md.includes('## 접근 요금제') && !md.includes('☑') && !md.includes('☐'), 'access checklist table removed');
  assert.ok(md.includes('- off-peak·파레토, score 원 API') && !md.includes('Free 경로 가격 0'));
  const text = renderTop10FromRecords({ publicationDate: '2026-10-13', records: RECORDS });
  assert.ok(!text.includes('선행') && !text.includes('(크레딧'));
});

const STAR_RECORDS = [{ modelId: 'step-5', value: 43.7, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'big-pickle', value: 30, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'ling-3-0-flash-fin', value: 22.6, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'mimo-v2-5', value: 70, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'ling-3-0-flash-fin', value: 60, metric: CODE, priceInput: 0, priceOutput: 0 }];
// p52: Free 표도 역할별 가중치. Free 경로는 접근 근거일 뿐 가격을 바꾸지 않는다(관측 단가 0은 실제 0).
const STAR_COGNITION = [{ modelId: 'mimo-v2-5', value: 0.7, metric: 'cognition_correct' }, { modelId: 'ling-3-0-flash-fin', value: 0.6, metric: 'cognition_correct' }];
test('free pareto marks only score-undominated rows; dominated rows carry no mark', () => {
  const section = renderLetterPartsFromRecords({ publicationDate: '2026-10-13', records: STAR_RECORDS, cognitionRecords: STAR_COGNITION, freeCatalog: FREE_CATALOG }).comments[2];
  const rows = section.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| 모델') && !line.startsWith('| ---'));
  const marked = rows.filter(line => line.includes('👍 파레토'));
  assert.ok(marked.length > 0, section);
  assert.ok(marked.every(line => /^\| [^|]+ \| ✓ [\d.]+ \| /.test(line)), '파레토 표시는 그 영역을 통과한 행에만 붙는다');
  assert.ok(rows.some(line => /^\| [^|]+ \| ✗ \| /.test(line)), '근거는 있고 미달인 행은 ✗');
});
test('a verified Free path alone is access evidence, not price evidence; unmeasured rows keep - cells', () => {
  const sparse = [{ modelId: 'step-5', value: 43.7, metric: INTEL, priceInput: 0, priceOutput: 0 }, { modelId: 'ling-3-0-flash-fin', value: 60, metric: CODE, priceInput: 0, priceOutput: 0 }];
  const parts = renderLetterPartsFromRecords({ publicationDate: '2026-10-13', records: sparse, freeCatalog: FREE_CATALOG });
  const section = parts.comments[2], md = joinLetterParts(parts);
  for (const id of ['big-pickle', 'mimo-v2-5']) {
    assert.ok(section.includes(`| ${id} | ✗ | ✗ | - | ✓ |  |`),
      `${id}: Free 접근 근거만으로는 두 영역 다 통과하지 못한다(✗)`);
  }
  assert.ok(!section.includes('근거 없음') && !md.includes('- AA 미측정(순위 제외)'), '이 픽스처에는 스코어를 못 내는 미측정 행이 없다');
  const text = renderTop10FromRecords({ publicationDate: '2026-10-13', records: sparse, freeCatalog: FREE_CATALOG });
  assert.ok(text.includes('big-pickle · 오케 ✗ · 워커 ✗ · Zen ✓ · '), text);
});
test('freeMessenger 있으면 4역할 머리', () => {
  const section = renderLetterPartsFromRecords({ publicationDate: '2026-10-13', records: RECORDS, freeCatalog: FREE_CATALOG,
    freeReviewer: [{ modelId: 'step-5', score: '0.80', passed: true }], freeMessenger: [{ modelId: 'step-5', score: '70.00', passed: true }] }).comments[2];
  assert.ok(section.includes('| 오케 | 리뷰어 | 워커 | 메신저 |'), '4역할 머리');
});
