import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeModelName } from '../src/insights/model-id.js';

test('OpenRouter 콜론 태그(:free·:beta)를 떼고 그 앞 날짜도 함께 제거한다', () => {
  assert.equal(normalizeModelName('vendor/foo-20260101:free'), 'foo');
  assert.equal(normalizeModelName('foo:free'), 'foo');
  assert.equal(normalizeModelName('foo:beta'), 'foo');
  assert.equal(normalizeModelName('foo-20260101:free'), 'foo');
  assert.equal(normalizeModelName('Vendor/Foo-2026-01-01:FREE'), 'foo');
  assert.equal(normalizeModelName('foo-0430:beta'), 'foo');
  assert.equal(normalizeModelName('mimo-v2.5-20260422:free'), 'mimo-v2-5');
});

test('콜론 크기 표기와 태그 아닌 콜론 접미사는 보존한다', () => {
  assert.equal(normalizeModelName('gpt-oss:120b'), 'gpt-oss:120b');
  assert.equal(normalizeModelName('vendor/gpt-oss:20b'), 'gpt-oss:20b');
  assert.equal(normalizeModelName('gpt-oss:120b:free'), 'gpt-oss:120b');
  assert.equal(normalizeModelName('foo:extended'), 'foo:extended');
});

test('p29 A2·A3·A4: nvidia- 접두·Claude 순서·gemma -it만 통일한다', () => {
  assert.equal(normalizeModelName('nvidia-nemotron-3-super-120b-a12b'), 'nemotron-3-super-120b-a12b');
  assert.equal(normalizeModelName('nvidia/nemotron-3-super-120b-a12b-20230311:free'), 'nemotron-3-super-120b-a12b');
  assert.notEqual(normalizeModelName('nvidia-nemotron-3-nano-30b-a3b'), normalizeModelName('nvidia-nemotron-3-nano-omni-30b-a3b'));
  assert.equal(normalizeModelName('claude-4-6-sonnet'), 'claude-sonnet-4-6');
  assert.equal(normalizeModelName('anthropic/claude-4.8-opus-20260528'), 'claude-opus-4-8');
  assert.equal(normalizeModelName('claude-4-5-sonnet'), 'claude-sonnet-4-5');
  assert.equal(normalizeModelName('claude-sonnet-4-6'), 'claude-sonnet-4-6');
  assert.equal(normalizeModelName('gemma-4-31b-it'), 'gemma-4-31b');
  assert.equal(normalizeModelName('google/gemma-4-26b-a4b-it-20260403'), 'gemma-4-26b-a4b');
  assert.equal(normalizeModelName('gemma-3-27b'), 'gemma-3-27b');
});

test('기존 날짜·점 규칙은 그대로다(연도 단독·무효 날짜 보존, 숫자 사이 점만 하이픈)', () => {
  assert.equal(normalizeModelName('mimo-v2-5-0424'), 'mimo-v2-5');
  assert.equal(normalizeModelName('model-2026-10-13'), 'model');
  assert.equal(normalizeModelName('mimo-v2.5-20260422'), 'mimo-v2-5');
  assert.equal(normalizeModelName('foo-2026'), 'foo-2026');
  assert.equal(normalizeModelName('foo-2026:free'), 'foo-2026');
  assert.equal(normalizeModelName('foo-2026-13-40'), 'foo-2026-13-40');
  assert.equal(normalizeModelName('foo-20260230'), 'foo-20260230');
  assert.equal(normalizeModelName('foo.v2.bar'), 'foo.v2.bar');
});
