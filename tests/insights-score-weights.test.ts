import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ROLE_DIMENSION_WEIGHTS } from '../src/insights/letter-top10-score.js';
import { loadScoreWeights, loadWorkerBonusCap, SCORE_WEIGHTS, SCORE_WEIGHTS_DEFAULTS, SCORE_WEIGHTS_PATH,
  validateScoreWeights, WORKER_BONUS_CAP, WORKER_BONUS_CAP_DEFAULT } from '../src/insights/letter-top10-score-weights.js';

/** p65 계약(docs/insights/score-weights.md): 파일 값=기본값 고정, 파일 없으면 기본값, 잘못된 값은 예외. p85: 워커 가산 상한도 고정. */

test('저장소 config/score-weights.json 값은 기본값과 같고 제품이 그 값을 쓴다', () => {
  assert.ok(existsSync(SCORE_WEIGHTS_PATH), SCORE_WEIGHTS_PATH);
  assert.deepEqual(SCORE_WEIGHTS, SCORE_WEIGHTS_DEFAULTS);
  assert.deepEqual(ROLE_DIMENSION_WEIGHTS, SCORE_WEIGHTS_DEFAULTS);
  assert.equal(ROLE_DIMENSION_WEIGHTS, SCORE_WEIGHTS, '정책 상수는 코드 리터럴이 아니라 로더 값을 그대로 쓴다');
  assert.equal(WORKER_BONUS_CAP, WORKER_BONUS_CAP_DEFAULT);
  assert.equal(WORKER_BONUS_CAP, loadWorkerBonusCap(SCORE_WEIGHTS_PATH));
});

test('파일이 없으면 저장소 기본값을 쓴다', () => {
  assert.deepEqual(loadScoreWeights(join(tmpdir(), 'yoroi-missing-score-weights.json')), SCORE_WEIGHTS_DEFAULTS);
});

test('잘못된 설정은 예외로 멈춘다(조용히 무시하지 않음)', () => {
  const defaults = SCORE_WEIGHTS_DEFAULTS;
  const cases: readonly (readonly [string, unknown])[] = [
    ['unknown role', { ...defaults, extra: { performance: 1, usage: 0, speed: 0, price: 0 } }],
    ['unknown dimension', { ...defaults, worker: { ...defaults.worker, misc: 0 } }],
    ['non-number', { ...defaults, worker: { ...defaults.worker, speed: '0.1' } }],
    ['negative', { ...defaults, worker: { ...defaults.worker, speed: -0.1 } }],
    ['sum is not 1', { ...defaults, worker: { ...defaults.worker, price: 0.6 } }],
    ['missing role', { orchestrator: defaults.orchestrator }],
    ['bad bonus cap', { ...defaults, workerBonusCap: -1 }],
    ['non-number bonus cap', { ...defaults, workerBonusCap: '5' }],
    ['non-object root', []],
  ];
  for (const [label, raw] of cases) assert.throws(() => validateScoreWeights(raw), /Invalid score weights/, label);
});

test('가산 상한 로더: 없으면 기본값, 잘못된 값은 예외', () => {
  assert.equal(loadWorkerBonusCap(join(tmpdir(), 'yoroi-missing-score-weights.json')), WORKER_BONUS_CAP_DEFAULT);
  const folder = mkdtempSync(join(tmpdir(), 'yoroi-weights-cap-'));
  const bad = join(folder, 'bad.json');
  writeFileSync(bad, JSON.stringify({ ...SCORE_WEIGHTS_DEFAULTS, workerBonusCap: -2 }));
  assert.throws(() => loadWorkerBonusCap(bad), /Invalid score weights/);
  assert.throws(() => validateScoreWeights({ ...SCORE_WEIGHTS_DEFAULTS, workerBonusCap: -2 }), /Invalid score weights/);
});

test('파일 로더도 같은 예외를 내고, 올바른 파일은 통과한다', () => {
  const folder = mkdtempSync(join(tmpdir(), 'yoroi-weights-'));
  const good = join(folder, 'good.json'), bad = join(folder, 'bad.json');
  writeFileSync(good, JSON.stringify(SCORE_WEIGHTS_DEFAULTS));
  writeFileSync(bad, JSON.stringify({ ...SCORE_WEIGHTS_DEFAULTS, worker: { ...SCORE_WEIGHTS_DEFAULTS.worker, usage: 0.5 } }));
  assert.deepEqual(loadScoreWeights(good), SCORE_WEIGHTS_DEFAULTS);
  assert.throws(() => loadScoreWeights(bad), /Invalid score weights/);
});
