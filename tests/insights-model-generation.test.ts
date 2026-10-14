import assert from 'node:assert/strict';
import test from 'node:test';
import { olderGenerationModelIds, parseFamilyVersion } from '../src/insights/letter-top10-filter.js';
import { normalizeModelName } from '../src/insights/letter-top10-rank.js';

const older = (ids: readonly string[]): string[] => [...olderGenerationModelIds(ids)];

test('normalizeModelName: 말단 달력 날짜 스냅샷과 숫자 사이 점만 정규화한다', () => {
  assert.equal(normalizeModelName('xiaomi/mimo-v2.5-20260422'), 'mimo-v2-5');
  assert.equal(normalizeModelName('mimo-v2-5-0424'), 'mimo-v2-5');
  assert.equal(normalizeModelName('mimo-v2.6-flash'), 'mimo-v2-6-flash');
  assert.equal(normalizeModelName('gpt-6.1-sol'), 'gpt-6-1-sol');
  assert.equal(normalizeModelName('gpt-4o-2024'), 'gpt-4o-2024');
  assert.equal(normalizeModelName('foo-0230'), 'foo-0230');
  assert.equal(normalizeModelName('qwen3-235b'), 'qwen3-235b');
});

test('olderGenerationModelIds: 무등급 기본형은 등급 꼬리(flash/pro)의 상위 버전에만 밀린다', () => {
  assert.deepEqual(older(['mimo-v2-5', 'mimo-v2-6-flash']), ['mimo-v2-5']);
  assert.deepEqual(older(['mimo-v2-5', 'mimo-v2-6-pro']), ['mimo-v2-5']);
  assert.deepEqual(older(['mimo-v2-6-flash', 'mimo-v2-6-pro']), []);
  assert.deepEqual(older(['glm-5-3', 'glm-5-3-flash']), []);
  assert.deepEqual(older(['claude-opus-5-5', 'claude-sonnet-5-6']), []);
  assert.deepEqual(older(['gpt-6-luna', 'gpt-6-1-sol']), []);
  assert.deepEqual(older(['gpt-5-6-luna', 'gpt-6-luna']), ['gpt-5-6-luna']);
});

test('olderGenerationModelIds: 미등록 라인·등급과 GPT 등급은 기본형 교체 대상이 아니다', () => {
  assert.deepEqual(older(['foo-1', 'foo-2-mini']), []);
  assert.deepEqual(older(['gpt-6-sol', 'gpt-6-1-sol-mini']), []);
  assert.deepEqual(older(['mimo-v2-5', 'mimo-v2-6-mini']), []);
  assert.deepEqual(older(['glm-5-2', 'glm-5-3-flash']), []);
  assert.deepEqual(older(['foo-1', 'foo-2']), ['foo-1']);
  assert.deepEqual(older(['gpt-6-sol', 'gpt-6-1-sol']), ['gpt-6-sol']);
  assert.deepEqual(older(['gpt-5-6-sol', 'gpt-6-luna']), ['gpt-5-6-sol']);
});

test('olderGenerationModelIds: MiMo 기본형만 제거하고 같은 세대 등급들은 보존한다', () => {
  assert.deepEqual(older(['mimo-v2-5-0424', 'mimo-v2.6-flash', 'mimo-v2-6-pro']), ['mimo-v2-5']);
  assert.deepEqual(older(['mimo-v2-6', 'mimo-v2-6-flash', 'mimo-v2-6-pro']), []);
});

test('kimi-k2-7-code와 kimi-k3는 서로 다른 계열로 제외하지 않는다(2026-10-13 사용자 결정)', () => {
  assert.deepEqual(parseFamilyVersion('kimi-k2-7-code'), { family: 'kimi-k2-code', version: [7] });
  assert.equal(parseFamilyVersion('kimi-k3'), null);
  assert.deepEqual(older(['kimi-k2-7-code', 'kimi-k3']), []);
  assert.deepEqual(older(['kimi-k2-6', 'kimi-k2-7-code']), ['kimi-k2-6']); // 무등급 6은 더 높은 버전의 등급(code)에 밀린다(MiMo 규칙)
  assert.deepEqual(older(['kimi-k2-6']), []); // 단독이면 유지
});
