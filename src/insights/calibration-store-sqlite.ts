import type { DatabaseSync } from 'node:sqlite';
import { openDatabase, withMigrationRetry } from '../infra/sqlite/database.js';
import { resolveDbPath } from '../infra/sqlite/data-dir.js';
import type { Migration } from '../infra/sqlite/migrations.js';
import { assertRunRecord, type CalibrationRunRecord, type CalibrationStore, CALIBRATION_HISTORY_CAP } from './calibration-store.js';
import { decodeCalibrationPayload, encodeCalibrationPayload, sanitizeViolationClasses } from './calibration-store-codec.js';
import { toRunRecord } from './calibration-record.js';

/** #180 unit 3: calibration_runs 테이블(v7). 기존 테이블에 손대지 않는다. */
const V7: Migration = { version: 7, sql: `
  CREATE TABLE calibration_runs (
    run_id TEXT PRIMARY KEY, model_id TEXT NOT NULL, task_set_version TEXT NOT NULL,
    evaluator_version TEXT NOT NULL, run_at TEXT NOT NULL, tasks_json TEXT NOT NULL,
    violations_json TEXT NOT NULL, total_score REAL NOT NULL, verdict TEXT NOT NULL,
    sample_status TEXT NOT NULL, sample_count INTEGER NOT NULL CHECK(sample_count >= 0),
    saved_at TEXT NOT NULL
  );
  CREATE INDEX idx_calibration_runs_model ON calibration_runs(model_id, run_at DESC);` };
export const CALIBRATION_MIGRATIONS: readonly Migration[] = [V7];

interface RunRow { run_id: string; model_id: string; task_set_version: string; evaluator_version: string;
  run_at: string; tasks_json: string; violations_json: string; total_score: number; verdict: string;
  sample_status: string; sample_count: number }
const toRecord = (r: RunRow): CalibrationRunRecord => {
  const payload = decodeCalibrationPayload(r.tasks_json);
  return { runId: r.run_id, modelId: r.model_id,
    taskSetVersion: r.task_set_version, evaluatorVersion: r.evaluator_version, runAt: r.run_at,
    tasks: payload.tasks,
    ...(payload.payload !== undefined && { samples: payload.payload.samples,
      taskAggregates: payload.payload.taskAggregates, aggregate: payload.payload.aggregate }),
    violationClasses: sanitizeViolationClasses(parseJsonArray(r.violations_json)),
    totalScore: r.total_score, verdict: r.verdict as CalibrationRunRecord['verdict'],
    sampleStatus: r.sample_status as CalibrationRunRecord['sampleStatus'], sampleCount: r.sample_count };
};

/** 파손 컬럼은 행 단위로 복구한다(한 행이 목록 전체를 깨뜨리지 않게 한다). */
function parseJsonArray(json: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class SqliteCalibrationStore implements CalibrationStore {
  constructor(private readonly db: DatabaseSync) {}
  saveRun(record: CalibrationRunRecord): void {
    const r = toRunRecord(record as unknown as Record<string, unknown>);
    assertRunRecord(r);
    this.write(() => this.db.prepare(`INSERT INTO calibration_runs (run_id, model_id, task_set_version,
      evaluator_version, run_at, tasks_json, violations_json, total_score, verdict, sample_status,
      sample_count, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(r.runId, r.modelId, r.taskSetVersion, r.evaluatorVersion, r.runAt, encodeCalibrationPayload(r),
        JSON.stringify(r.violationClasses), r.totalScore, r.verdict, r.sampleStatus, r.sampleCount,
        new Date().toISOString()));
    this.prune(r.modelId);
  }
  listRuns(modelId: string, taskSetVersion?: string): CalibrationRunRecord[] {
    const rows = (taskSetVersion === undefined
      ? this.db.prepare('SELECT * FROM calibration_runs WHERE model_id = ? ORDER BY run_at DESC, rowid DESC').all(modelId)
      : this.db.prepare(`SELECT * FROM calibration_runs WHERE model_id = ? AND task_set_version = ?
        ORDER BY run_at DESC, rowid DESC`).all(modelId, taskSetVersion)) as unknown as RunRow[];
    return rows.map(toRecord);
  }
  prune(modelId: string, keep: number = CALIBRATION_HISTORY_CAP): number {
    return Number(this.write(() => this.db.prepare(`DELETE FROM calibration_runs WHERE model_id = ?
      AND run_id NOT IN (SELECT run_id FROM calibration_runs WHERE model_id = ? ORDER BY run_at DESC, rowid DESC LIMIT ?)
      `).run(modelId, modelId, keep).changes));
  }
  close(): void { this.db.close(); }
  private write<T>(run: () => T): T {
    return withMigrationRetry(() => {
      this.db.exec('BEGIN IMMEDIATE');
      try { const result = run(); this.db.exec('COMMIT'); return result; }
      catch (error) { this.db.exec('ROLLBACK'); throw error; }
    });
  }
}

export function openCalibrationStore(env: NodeJS.ProcessEnv): CalibrationStore {
  return new SqliteCalibrationStore(openDatabase(resolveDbPath(env), { migrations: CALIBRATION_MIGRATIONS }));
}
