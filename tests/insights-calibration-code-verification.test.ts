import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyTask2Code, verifyTask3Test } from '../src/insights/calibration-verifier.js';
import { seedSandboxFixtures } from '../src/insights/calibration-fixture-files.js';

test('verifyTask2Code: detects missing, unmodified, exit smuggle, type error, wrong logic, and correct code', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'calib-test-v2-'));
  try {
    const rMiss = await verifyTask2Code(dir);
    assert.equal(rMiss.pass, false);
    assert.equal(rMiss.reason, 'missing_file');

    await seedSandboxFixtures(dir, 'task-2-single-file-edit');
    const rUnmod = await verifyTask2Code(dir);
    assert.equal(rUnmod.pass, false);
    assert.equal(rUnmod.reason, 'unmodified');

    await writeFile(join(dir, 'src/target.ts'), 'export function targetValue(x: number) { return x * 2; }\nprocess.exit(0);\n');
    const rExit = await verifyTask2Code(dir);
    assert.equal(rExit.pass, false);
    assert.equal(rExit.reason, 'process_exit_forbidden');

    await writeFile(join(dir, 'src/target.ts'), 'export function targetValue(x: number): number { return "bad"; }\n');
    const rType = await verifyTask2Code(dir);
    assert.equal(rType.pass, false);
    assert.equal(rType.reason, 'type_error');

    await writeFile(join(dir, 'src/target.ts'), 'export function targetValue(x: number): number { return x + 99; }\n');
    const rWrong = await verifyTask2Code(dir);
    assert.equal(rWrong.pass, false);
    assert.equal(rWrong.reason, 'execution_failed');

    await writeFile(join(dir, 'src/target.ts'), 'export function targetValue(x: number): number { return x * 2; }\n');
    const rGood = await verifyTask2Code(dir);
    assert.equal(rGood.pass, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('verifyTask3Test: detects unmodified math, exit smuggle, type error, failing test, tampered fixture, and fix', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'calib-test-v3-'));
  try {
    await seedSandboxFixtures(dir, 'task-3-test-fix');
    const rUnmod = await verifyTask3Test(dir);
    assert.equal(rUnmod.pass, false);
    assert.equal(rUnmod.reason, 'unmodified');

    await writeFile(join(dir, 'src/math.ts'), 'export function add(a: number, b: number) { return a + b; }\nprocess.exit(0);\n');
    const rExit = await verifyTask3Test(dir);
    assert.equal(rExit.pass, false);
    assert.equal(rExit.reason, 'process_exit_forbidden');

    await writeFile(join(dir, 'src/math.ts'), 'export function add(a: number, b: number): number { return "bad"; }\n');
    const rType = await verifyTask3Test(dir);
    assert.equal(rType.pass, false);
    assert.equal(rType.reason, 'type_error');

    await writeFile(join(dir, 'src/math.ts'), 'export function add(a: number, b: number): number { return a * b; }\n');
    const rWrong = await verifyTask3Test(dir);
    assert.equal(rWrong.pass, false);
    assert.equal(rWrong.reason, 'execution_failed');

    await writeFile(join(dir, 'tests/math.test.ts'), 'test("tampered", () => {});\n');
    const rTampered = await verifyTask3Test(dir);
    assert.equal(rTampered.pass, false);
    assert.equal(rTampered.reason, 'fixture_tampered');

    await seedSandboxFixtures(dir, 'task-3-test-fix');
    await writeFile(join(dir, 'src/math.ts'), 'export function add(a: number, b: number): number { return a + b; }\n');
    const rGood = await verifyTask3Test(dir);
    assert.equal(rGood.pass, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
