import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCatalogAliasResolver } from '../src/insights/model-aliases.js';
import { freeMessengerEntries } from '../src/composition/insights-free-reviewer.js';
import { normalizeModelName } from '../src/insights/model-id.js';
import { officialFreeListing, parseOfficialFreeIdsFromPage } from '../src/insights/opencode-free-official.js';

/** 실제 공식 목록 형태 그대로(DeepSeek/GLM/MiMo + MiniMax). */
const PAGE = '<table><tbody>' +
  '<tr><td>MiniMax M3.1 Flash Free</td><td>minimax-m3.1-flash-free</td></tr>' +
  '<tr><td>DeepSeek V4.1 Flash Free</td><td>deepseek-v4.1-flash-free</td></tr>' +
  '<tr><td>GLM-5.3 Flash Free</td><td>glm-5.3-flash-free</td></tr>' +
  '<tr><td>MiMo-V2.6-Flash Free</td><td>mimo-v2.6-flash-free</td></tr>' +
  '</tbody></table><table><tbody>' +
  '<tr><td>MiniMax M3.1 Flash Free</td><td>Free</td><td>Free</td></tr>' +
  '<tr><td>DeepSeek V4.1 Flash Free</td><td>Free</td><td>Free</td></tr>' +
  '<tr><td>GLM-5.3 Flash Free</td><td>Free</td><td>Free</td></tr>' +
  '<tr><td>MiMo-V2.6-Flash Free</td><td>Free</td><td>Free</td></tr></tbody></table>';
const AA = ['minimax-m3-1-flash', 'deepseek-v4-1-flash', 'glm-5-3-flash', 'mimo-v2-6-flash'];

test('verified Free -free id가 AA base id와 이어진다', () => {
  const ids = parseOfficialFreeIdsFromPage(PAGE)!;
  assert.equal(ids.length, 4);
  const listing = officialFreeListing({ goPage: ids });
  assert.equal(listing.go.length, 4);
  const records = AA.map(modelId => ({ modelId, metric: 'x', value: 1 }));
  const resolve = buildCatalogAliasResolver(records, ids);
  for (const id of ids) assert.ok(AA.includes(resolve(normalizeModelName(id))), `${id} 연결됨`);
});

test('미확인 -free id는 무료로 승격되지 않는다', () => {
  const resolve = buildCatalogAliasResolver([], ['minimax-m3-1-flash-free']);
  assert.equal(resolve('ghost-model-free'), 'ghost-model-free', '모르는 id 그대로');
});
test('별칭 4건이 메신저 병합에서도 exact Free ID로 이어진다', () => {
  const models = ['minimax-m3-1-flash-free', 'deepseek-v4-1-flash-free', 'glm-5-3-flash-free', 'mimo-v2-6-flash-free']
    .map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://x.test', checkedOn: '2026-10-14', verified: true }));
  const catalog = [{ planId: 'go-free', planName: 'Go Free', tier: 'free', models }] as const;
  const entries = freeMessengerEntries([
    { modelId: 'minimax-m3-1-flash', score: 70 }, { modelId: 'deepseek-v4-1-flash', score: 71 },
    { modelId: 'glm-5-3-flash', score: 72 }, { modelId: 'mimo-v2-6-flash', score: 73 },
    { modelId: 'ghost-model', score: 99 }, { modelId: 'minimax-m3-1-flash' }], [...catalog]);
  assert.deepEqual(entries.map(e => e.modelId),
    ['minimax-m3-1-flash-free', 'deepseek-v4-1-flash-free', 'glm-5-3-flash-free', 'mimo-v2-6-flash-free']);
  assert.deepEqual(entries.map(e => e.score), ['70.00', '71.00', '72.00', '73.00']);
});
