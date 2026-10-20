import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../src/infra/sqlite/database.js';
import { resolveDbPath } from '../src/infra/sqlite/data-dir.js';
import { CALIBRATION_HISTORY_CAP, toRunRecord, type CalibrationRunRecord, type CalibrationStore } from '../src/insights/calibration-store.js';
import { CALIBRATION_MIGRATIONS, openCalibrationStore } from '../src/insights/calibration-store-sqlite.js';

const run = (id: string, model = 'muse-spark-1-3', version = 'v1'): CalibrationRunRecord => ({
  runId: id, modelId: model, taskSetVersion: version, evaluatorVersion: 'v1',
  runAt: `2026-10-20T00:00:00.${id.slice(-3)}Z`,
  tasks: [{ taskId: 'task-1', score: 100, passed: true, latencyMs: 500, retryCount: 0 }],
  violationClasses: [], totalScore: 100, verdict: 'capable', sampleStatus: 'provisional', sampleCount: 1,
});
function withStore(runFn: (store: CalibrationStore, env: NodeJS.ProcessEnv) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-calibration-')), env = { YOROI_DATA_DIR: root };
  const store = openCalibrationStore(env);
  try { runFn(store, env); } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
}
test('insert then list returns the same run', () => {
  withStore(store => {
    store.saveRun(run('run-001'));
    assert.deepEqual(store.listRuns('muse-spark-1-3'), [run('run-001')]);
    assert.deepEqual(store.listRuns('other-model'), []); });
});
test('reopen after write sees the same data', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-calibration-')), env = { YOROI_DATA_DIR: root };
  try {
    openCalibrationStore(env).saveRun(run('run-001'));
    const reopened = openCalibrationStore(env);
    try { assert.deepEqual(reopened.listRuns('muse-spark-1-3'), [run('run-001')]); }
    finally { reopened.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('prune keeps newest runs and reports the deleted count', () => {
  withStore(store => {
    for (const id of ['run-001', 'run-002', 'run-003']) store.saveRun(run(id));
    assert.equal(store.prune('muse-spark-1-3', 2), 1);
    assert.deepEqual(store.listRuns('muse-spark-1-3').map(r => r.runId), ['run-003', 'run-002']); });
});
test('saveRun enforces the per-model retention cap', () => {
  withStore(store => {
    for (let i = 1; i <= CALIBRATION_HISTORY_CAP + 2; i += 1) store.saveRun(run(`run-${String(i).padStart(3, '0')}`));
    const rows = store.listRuns('muse-spark-1-3');
    assert.equal(rows.length, CALIBRATION_HISTORY_CAP);
    assert.equal(rows[0]!.runId, `run-${String(CALIBRATION_HISTORY_CAP + 2).padStart(3, '0')}`); });
});
test('task-set version change is a separate sample and never merges', () => {
  withStore(store => {
    store.saveRun(run('run-001', 'muse-spark-1-3', 'v1'));
    store.saveRun(run('run-002', 'muse-spark-1-3', 'v2'));
    assert.equal(store.listRuns('muse-spark-1-3').length, 2);
    assert.deepEqual(store.listRuns('muse-spark-1-3', 'v1').map(r => r.runId), ['run-001']);
    assert.deepEqual(store.listRuns('muse-spark-1-3', 'v2').map(r => r.runId), ['run-002']); });
});
test('구버전(배열형 tasks) 레코드는 samples 없이 읽히고 보존 상한은 유지된다', () => {
  withStore(store => {
    store.saveRun(run('old-001'));
    const [row] = store.listRuns('muse-spark-1-3');
    assert.equal(row?.tasks.length, 1); assert.equal(row?.samples, undefined, '구버전 payload에는 samples가 없다');
    assert.equal(row?.totalScore, 100);
    for (let i = 0; i < CALIBRATION_HISTORY_CAP + 2; i += 1) store.saveRun(run(`run-${String(i).padStart(3, '0')}`));
    assert.equal(store.listRuns('muse-spark-1-3').length, CALIBRATION_HISTORY_CAP); });
});
test('파손 violations_json 행은 목록 전체를 깨뜨리지 않는다(행 단위 복구)', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-calib-corrupt-')), env = { YOROI_DATA_DIR: root };
  const db = openDatabase(resolveDbPath(env), { migrations: CALIBRATION_MIGRATIONS });
  db.prepare(`INSERT INTO calibration_runs (run_id, model_id, task_set_version, evaluator_version, run_at,
    tasks_json, violations_json, total_score, verdict, sample_status, sample_count, saved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run('bad-1', 'muse-spark-1-3', 'v1', 'v2', '2026-10-20T00:00:00.000Z',
    JSON.stringify([{ taskId: 't1', score: 100, passed: true, latencyMs: 1, retryCount: 0 }]), '{oops', 100,
    'capable', 'provisional', 1, '2026-10-20T00:00:00.000Z');
  db.close();
  const store = openCalibrationStore(env);
  try {
    const rows = store.listRuns('muse-spark-1-3');
    assert.equal(rows.length, 1); assert.equal(rows[0]!.runId, 'bad-1');
    assert.deepEqual(rows[0]!.violationClasses, [], '파손 위반 컬럼은 빈 배열로 복구');
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});
test('prompt/response/tool-log/diff/credential fields cannot persist through the port', () => {
  const dirty = { ...run('run-009'), prompt: 'secret prompt', response: { text: 'x' }, toolLog: [],
    diff: '--- a', apiKey: 'sk-test', password: 'pw', token: 't' } as unknown as Record<string, unknown>;
  const clean = toRunRecord(dirty);
  for (const key of ['prompt', 'response', 'toolLog', 'diff', 'apiKey', 'password', 'token']) assert.ok(!(key in clean), key);
  withStore(store => {
    store.saveRun(dirty as unknown as CalibrationRunRecord);
    const raw = JSON.stringify(store.listRuns('muse-spark-1-3'));
    for (const leak of ['secret prompt', 'sk-test']) assert.ok(!raw.includes(leak), leak); });
});
