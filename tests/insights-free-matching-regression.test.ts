import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCatalogAliasResolver } from '../src/insights/model-aliases.js';
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