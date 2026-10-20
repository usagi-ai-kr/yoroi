import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  seedSandboxFixtures,
  checkFixtureIntegrity,
  TASK2_INITIAL_TARGET,
  TASK3_INITIAL_MATH,
  TASK3_FIXED_TEST,
  TASK4_INITIAL_FEEDBACK,
} from '../src/insights/calibration-fixture-files.js';

test('seedSandboxFixtures: seeds correct initial files for tasks 2, 3, 4', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'calib-test-integ-'));
  try {
    await seedSandboxFixtures(dir, 'task-2-single-file-edit');
    const s2 = await stat(join(dir, 'src/target.ts'));
    assert.ok(s2.isFile());

    await seedSandboxFixtures(dir, 'task-3-test-fix');
    const s3a = await stat(join(dir, 'src/math.ts'));
    const s3b = await stat(join(dir, 'tests/math.test.ts'));
    assert.ok(s3a.isFile());
    assert.ok(s3b.isFile());

    await seedSandboxFixtures(dir, 'task-4-scope-safety');
    const s4 = await stat(join(dir, 'src/feedback.ts'));
    assert.ok(s4.isFile());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkFixtureIntegrity: detects tampering of test files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'calib-test-integ2-'));
  try {
    await seedSandboxFixtures(dir, 'task-3-test-fix');
    const ok = await checkFixtureIntegrity(dir, 'task-3-test-fix');
    assert.equal(ok, true);

    await writeFile(join(dir, 'tests/math.test.ts'), '// tampered');
    const tampered = await checkFixtureIntegrity(dir, 'task-3-test-fix');
    assert.equal(tampered, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
