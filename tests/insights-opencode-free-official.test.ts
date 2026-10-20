import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalFreeId, OFFICIAL_GO_FREE_IDS, OFFICIAL_ZEN_FREE_IDS, officialFreeListing,
  officialFreePlans, parseOfficialFreeIdsFromPage, parseOfficialModelIds } from '../src/insights/opencode-free-official.js';
import { buildOfficialFreeCatalog, collectOfficialFreeListing, parseOpenCodeFreeModels } from '../src/insights/opencode-free-models.js';
import type { HttpClient } from '../src/infra/http-client.js';

const apiRow = (id: string) => ({ id, object: 'model', created: 1792485317, owned_by: 'opencode' });
const OFFICIAL_ZEN_RESPONSE = { object: 'list', data: ['deepseek-v4.1-flash', 'deepseek-v4.1-flash-free', 'glm-5.3-flash-free',
  'minimax-m3.1-flash-free', 'big-pickle', 'step-5-preview'].map(apiRow) };
const OFFICIAL_GO_RESPONSE = { object: 'list', data: ['beam-free', 'longcat-2.5-preview-free', 'minimax-m3.1-flash-free',
  'step-5-preview'].map(apiRow) };
const ZEN_PAGE_ROWS = [['Big Pickle', 'big-pickle'], ['GLM-5.3-Flash Free', 'glm-5.3-flash-free'],
  ['DeepSeek V4.1 Flash Free', 'deepseek-v4.1-flash-free'], ['MiniMax M3.1 Flash Free', 'minimax-m3.1-flash-free'],
  ['Beam Free', 'beam-free'], ['LL Alpha Free', 'll-alpha-free'], ['LongCat 2.5 Preview Free', 'longcat-2.5-preview-free'],
  ['Exo Free', 'exo-free'], ['MiMo-V2.6-Flash Free', 'mimo-v2.6-flash-free'], ['MiMo-V2.5 Free', 'mimo-v2.5-free'],
  ['Nemotron 3 Ultra Free', 'nemotron-3-ultra-free'], ['Nemotron 3.5 Lightning Free', 'nemotron-3.5-lightning-free'],
  ['Nemotron 3.5 Super VL Free', 'nemotron-3.5-super-vl-free'], ['Jev 1.13 Free', 'jev-1.13-free']] as const;
/** 실제 공식 페이지와 같은 2개 표: 엔드포인트 표(이름→id) + 가격 표(이름 + Free 가격). */
const pageHtml = (rows: readonly (readonly [string, string])[]): string =>
  '<table><tbody>' + rows.map(([name, id]) => `<tr><td>${name}</td><td>${id}</td><td>endpoint</td></tr>`).join('') + '</tbody></table>' +
  '<table><tbody>' + rows.map(([name]) => `<tr><td>${name}</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr>`).join('') + '</tbody></table>';
const GO_PAGE_ROWS = [['LongCat 2.5 Preview Free', 'longcat-2.5-preview-free'], ['Beam Free', 'beam-free'],
  ['MiniMax M3.1 Flash Free', 'minimax-m3.1-flash-free']] as const;

test('공식 원본 파서: 공개 모델 API 응답에서 id 만 추출하고 형식 불일치는 undefined', () => {
  assert.deepEqual(parseOfficialModelIds(OFFICIAL_ZEN_RESPONSE),
    ['deepseek-v4.1-flash', 'deepseek-v4.1-flash-free', 'glm-5.3-flash-free', 'minimax-m3.1-flash-free', 'big-pickle', 'step-5-preview']);
  assert.equal(parseOfficialModelIds({ object: 'list' }), undefined);
  assert.equal(parseOfficialModelIds({ data: [{ object: 'model' }] }), undefined, 'id 없는 항목은 근거 불가');
  assert.equal(parseOfficialModelIds(null), undefined);
});

/** BLOCK-1 증거: 'Jev 1.13 Free'(Free/Free) 와 부분 Free 'Jev 1.13'(입력 $0.042 + 출력 Free)을 구분한다. */
const JEV_PAGE = '<table><tbody><tr><td>Jev 1.13 Free</td><td>jev-1.13-free</td><td>endpoint</td></tr>' +
  '<tr><td>Jev 1.13</td><td>jev-1.13</td><td>endpoint</td></tr></tbody></table><table><tbody>' +
  '<tr><td>Jev 1.13 Free</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr>' +
  '<tr><td>Jev 1.13</td><td>$0.042</td><td>Free</td><td>-</td><td>-</td></tr></tbody></table>';

test('공식 페이지 파서: 명시적 Free 행만 free(id 표가 있는 행만)', () => {
  const ids = parseOfficialFreeIdsFromPage(pageHtml(ZEN_PAGE_ROWS))!;
  assert.equal(ids.length, 14);
  assert.ok(ids.includes('minimax-m3.1-flash-free') && ids.includes('big-pickle'));
  assert.equal(parseOfficialFreeIdsFromPage('<table><tr><td>Step 5 Preview</td><td>$1.00</td><td>$2.70</td></tr></table>'), undefined,
    '가격 0/0 또는 Free 표기가 없으면 free 아님');
  const jev = parseOfficialFreeIdsFromPage(JEV_PAGE)!;
  assert.ok(jev.includes('jev-1.13-free'), 'Jev 1.13 Free(Free/Free)은 free');
  assert.ok(!jev.includes('jev-1.13'), '부분 Free(입력 $0.042 + 출력 Free)는 free 아님');
});

test('status: 두 페이지 확인=live, 일부=mixed, 실패=last-good(honest date)', () => {
  const both = officialFreeListing({ zenPage: parseOfficialFreeIdsFromPage(pageHtml(ZEN_PAGE_ROWS))!,
    goPage: parseOfficialFreeIdsFromPage(pageHtml(GO_PAGE_ROWS))! });
  assert.equal(both.status, 'live');
  assert.equal(both.checkedOn, '2026-10-20');
  assert.ok(!both.go.includes('step-5-preview'), 'Go 유료 모델은 Go Free 아님');
  const one = officialFreeListing({ goPage: parseOfficialFreeIdsFromPage(pageHtml(GO_PAGE_ROWS))! });
  assert.equal(one.status, 'mixed');
  const none = officialFreeListing();
  assert.equal(none.status, 'last-good');
  assert.equal(none.checkedOn, '2026-10-20');
  assert.deepEqual([...none.zen].sort(), [...OFFICIAL_ZEN_FREE_IDS].sort());
  assert.deepEqual([...none.go].sort(), [...OFFICIAL_GO_FREE_IDS].sort());
});

test('API id 는 존재 참고일 뿐 free 판정 근거가 아니다', () => {
  const listing = officialFreeListing({ zenApi: parseOfficialModelIds(OFFICIAL_ZEN_RESPONSE)! });
  assert.deepEqual(listing.apiPresence?.zen, ['deepseek-v4.1-flash', 'deepseek-v4.1-flash-free', 'glm-5.3-flash-free',
    'minimax-m3.1-flash-free', 'big-pickle', 'step-5-preview']);
  assert.ok(!listing.zen.includes('deepseek-v4.1-flash'), '유료 모델 id 존재만으로 free 아님');
  assert.equal(listing.status, 'last-good');
  assert.equal(canonicalFreeId('MiniMax M3.1 Flash Free'), 'minimax-m3-1-flash-free');
});

test('공격 시 last-good 유지 + honest status (발행 차단 아님)', async () => {
  const failing: HttpClient = { request: async () => { throw new Error('offline'); } };
  const res = await collectOfficialFreeListing(failing);
  assert.equal(res.pageFailed, true);
  assert.equal(res.listing.status, 'last-good');
  assert.equal(res.listing.checkedOn, '2026-10-20');
  assert.equal(res.listing.zen.length, 14);
});

test('공식 free 플랜은 verified + 출처 URL·확인 날짜를 그대로 실는다', () => {
  const plans = officialFreePlans(officialFreeListing());
  const zen = plans.find(p => p.planId === 'opencode-zen-free')!;
  assert.equal(zen.tier, 'free');
  assert.ok(zen.models.every(m => m.verified && m.free));
  assert.ok(zen.models.every(m => m.sourceUrl === 'https://opencode.ai/v2/docs/console/models' && m.checkedOn === '2026-10-20'));
});

test('CLI 관측만으로는 free 를 확정하지 않는다(미검증·별도 분리)', () => {
  const listing = officialFreeListing({ zenPage: ['minimax-m3.1-flash-free'], goPage: ['minimax-m3.1-flash-free'] });
  const cli = parseOpenCodeFreeModels('opencode/minimax-m3.1-flash-free\nopencode/step-5-preview-free\nopencode-go/beam-free');
  const built = buildOfficialFreeCatalog(cli, '2026-10-20', listing);
  assert.equal(built.plans.length, 2);
  assert.deepEqual(built.plans[0]!.models.map(m => m.modelId), ['minimax-m3-1-flash-free']);
  assert.ok(built.plans.every(p => p.verified && p.models.every(m => m.verified)));
  assert.ok(built.observedOnly.includes('step-5') && built.observedOnly.includes('beam'), '공식 목록에 없는 관측은 미검증으로 남는다');
});
