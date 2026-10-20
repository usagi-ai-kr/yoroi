import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  loadReviewerPolicy,
  resolveReviewerPolicyPath,
  validateReviewerWeights,
  BUNDLED_REVIEWER_POLICY_PATH,
  REVIEWER_POLICY,
  REVIEWER_WEIGHTS,
} from '../src/config/reviewer-policy.js';

test('1. default config loads confirmed 50/20/30 weights from bundled JSON', () => {
  assert.equal(REVIEWER_POLICY.status, 'confirmed');
  assert.equal(REVIEWER_POLICY.confirmed, true);
  assert.deepEqual(REVIEWER_WEIGHTS, { performance: 0.50, speed: 0.20, price: 0.30 });
});

test('2. rejects non-object, missing/unknown, negative, non-finite, and sum!=1', () => {
  assert.throws(() => validateReviewerWeights(null), /root must be an object/);
  assert.throws(() => validateReviewerWeights({ performance: 0.5, speed: 0.5 }), /dimension 'price' must be a finite number/);
  assert.throws(() => validateReviewerWeights({ performance: 0.5, speed: 0.3, price: 0.2, x: 1 }), /unknown dimension 'x'/);
  assert.throws(() => validateReviewerWeights({ performance: -0.1, speed: 0.5, price: 0.6 }), /must be a finite number >= 0/);
  assert.throws(() => validateReviewerWeights({ performance: 0.4, speed: 0.2, price: 0.3 }), /weights must sum to 1.0/);
});

test('3. explicit path and env override load with priority', () => {
  const tmp = join(tmpdir(), `test-rev-pol-${Date.now()}.json`);
  try {
    writeFileSync(tmp, JSON.stringify({ weights: { performance: 0.60, speed: 0.20, price: 0.20 } }));
    assert.equal(resolveReviewerPolicyPath({ explicitPath: tmp }), tmp);
    const loaded = loadReviewerPolicy(tmp);
    assert.deepEqual(loaded.weights, { performance: 0.60, speed: 0.20, price: 0.20 });
    const envLoaded = loadReviewerPolicy({ env: { YOROI_REVIEWER_POLICY_PATH: tmp } });
    assert.deepEqual(envLoaded.weights, { performance: 0.60, speed: 0.20, price: 0.20 });
  } finally {
    try { unlinkSync(tmp); } catch { /* ignore */ }
  }
});

test('4. XDG config directory override is detected when present', () => {
  const dir = join(tmpdir(), `test-xdg-${Date.now()}`);
  try {
    const xdgFile = join(dir, 'yoroi', 'reviewer-policy.json');
    mkdirSync(join(dir, 'yoroi'), { recursive: true });
    writeFileSync(xdgFile, JSON.stringify({ performance: 0.40, speed: 0.30, price: 0.30 }));
    assert.equal(resolveReviewerPolicyPath({ env: { XDG_CONFIG_HOME: dir } }), xdgFile);
    assert.deepEqual(loadReviewerPolicy({ env: { XDG_CONFIG_HOME: dir } }).weights, { performance: 0.40, speed: 0.30, price: 0.30 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('5. fail-fast on non-existent path or malformed JSON', () => {
  assert.throws(() => loadReviewerPolicy('/non/existent/path.json'), /configuration file not found/);
  const tmp = join(tmpdir(), `test-bad-json-${Date.now()}.json`);
  try {
    writeFileSync(tmp, '{ invalid json');
    assert.throws(() => loadReviewerPolicy(tmp), /malformed JSON/);
  } finally {
    try { unlinkSync(tmp); } catch { /* ignore */ }
  }
});

test('6. simulated package layout outside repo cwd finds bundled JSON', () => {
  const simPkg = join(tmpdir(), `test-sim-pkg-${Date.now()}`);
  try {
    mkdirSync(join(simPkg, 'dist', 'src', 'config'), { recursive: true });
    mkdirSync(join(simPkg, 'config'), { recursive: true });
    writeFileSync(join(simPkg, 'package.json'), JSON.stringify({ name: 'yoroi', files: ['dist', 'config/reviewer-policy.json'] }));
    writeFileSync(join(simPkg, 'config', 'reviewer-policy.json'), JSON.stringify({ performance: 0.50, speed: 0.20, price: 0.30 }));
    const simUrl = `file://${simPkg}/dist/src/config/reviewer-policy.js`;
    const loaded = loadReviewerPolicy(join(simPkg, 'config', 'reviewer-policy.json'));
    assert.deepEqual(loaded.weights, { performance: 0.50, speed: 0.20, price: 0.30 });
  } finally {
    rmSync(simPkg, { recursive: true, force: true });
  }
});
