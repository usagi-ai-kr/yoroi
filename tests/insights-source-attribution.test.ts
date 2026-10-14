import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCE_ATTRIBUTIONS } from '../src/insights/source-attribution.js';

test('letter attributions keep the internal-only condition for Cognition, list every source, and exclude Arena', () => {
  const cognition = SOURCE_ATTRIBUTIONS.find(line => line.includes('Cognition'));
  assert.ok(cognition?.includes('내부 전용'), String(cognition));
  assert.ok(SOURCE_ATTRIBUTIONS.some(line => line.includes('OpenCode Data')));
  assert.ok(!SOURCE_ATTRIBUTIONS.some(line => line.includes('lmarena-ai'))); // 2026-10-13 Arena 제외
  assert.equal(SOURCE_ATTRIBUTIONS.length, 4);
  assert.ok(!SOURCE_ATTRIBUTIONS.find(line => line.includes('OpenRouter'))?.includes('내부 전용'));
});
