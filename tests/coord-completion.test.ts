import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPTS = join(process.cwd(), '.agents/skills/agent-coordination/scripts');
const FAKE = `#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
if args[:2] == ["agent", "list"]:
    f = os.path.join(os.environ.get("DIR", "."), "scratch", "seq.txt")
    if os.path.isfile(f):
        lines = open(f).read().splitlines()
        status = lines.pop(0) if lines else "done"
        open(f, "w").write("\\n".join(lines))
    else: status = os.environ.get("FAKE_STATUS", "done")
    json.dump({"result": {"agents": [{"pane_id": "w12:p0", "agent": "fake", "agent_status": status,
        "state_change_seq": 1, "completion_seq": 0}]}}, sys.stdout); sys.exit(0)
if args[:2] == ["agent", "read"]:
    print("Build auto · Fake Model · max"); sys.exit(0)
sys.exit(2)
`;

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'coord-completion-'));
  writeFileSync(join(dir, 'herdr'), FAKE); chmodSync(join(dir, 'herdr'), 0o755);
  writeFileSync(join(dir, 'roster.md'), '| pane | 이름 | 역할 |\n| --- | --- | --- |\n| `w12:p0` | w2 | 워커 |\n');
  writeFileSync(join(dir, 'packet.json'), JSON.stringify({ task_id: 't1' }));
  mkdirSync(join(dir, 'scratch')); return dir;
}

function writeLog(dir: string, report: string, timeIso: string): void {
  const record = { time: timeIso, workspace: 'w12', label: 'w2', pane: 'w12:p0',
    packet: join(dir, 'packet.json'), report_path: report, result: 'turn_started', seq: 1 };
  writeFileSync(join(dir, 'scratch', 'coord-send.log'), JSON.stringify(record) + '\n');
}

function runWatch(dir: string, status: 'done' | 'working', extra: string[] = []) {
  const report = join(dir, 'report.json');
  const args = [join(SCRIPTS, 'coord.py'), 'watch', 'w2', '--reports', report,
    '--roster', join(dir, 'roster.md'), '--herdr', join(dir, 'herdr'), ...extra];
  const started = Date.now();
  const res = spawnSync('python3', args, { cwd: dir, env: { ...process.env, DIR: dir, FAKE_STATUS: status }, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout ?? ''}${res.stderr ?? ''}`, ms: Date.now() - started, report };
}

test('done + 보고서 없음 → REPORT_MISSING 즉시 반환 (대기 연장 없음, exit 4)', () => {
  const dir = fixture(), r = runWatch(dir, 'done');
  assert.equal(r.code, 4, r.out); assert.match(r.out, /REPORT_MISSING reconcile_now/);
});

test('watch 중 working→done 전이 시 다음 poll 즉시 REPORT_MISSING 반환 (exit 4)', () => {
  const dir = fixture();
  writeFileSync(join(dir, 'scratch', 'seq.txt'), 'working\ndone\n');
  const r = runWatch(dir, 'working', ['--interval', '0.05', '--max-polls', '10']);
  assert.equal(r.code, 4, r.out); assert.match(r.out, /REPORT_MISSING reconcile_now/);
  assert.ok(r.ms < 2000, `전이 감지가 지연됨: ${r.ms}ms`);
});

test('task 일치 보고서 → REPORT_READY / 불일치 → STALE_REPORT', () => {
  const dir = fixture(), report = join(dir, 'report.json');
  writeFileSync(report, JSON.stringify({ task_id: 't1' })); writeLog(dir, report, new Date().toISOString());
  assert.equal(runWatch(dir, 'done').code, 0);
  writeFileSync(report, JSON.stringify({ task_id: 'other' }));
  const r = runWatch(dir, 'done'); assert.equal(r.code, 6, r.out); assert.match(r.out, /STALE_REPORT/);
});

test('300초 예산 초과 → WATCH_DEADLINE (exit 5), 재호출 시에도 리셋 없음', () => {
  const dir = fixture(), report = join(dir, 'report.json');
  writeLog(dir, report, new Date(Date.now() - 301_000).toISOString()); // 301s ago (>300s budget)
  const first = runWatch(dir, 'working'), second = runWatch(dir, 'working');
  assert.equal(first.code, 5, first.out); assert.equal(second.code, 5, second.out);
  assert.match(second.out, /WATCH_DEADLINE budget_exceeded/);
});

test('send 기록 없음 → 위임 watch 유한 종료 (exit 3, no change)', () => {
  const dir = fixture();
  const r = runWatch(dir, 'working', ['--interval', '0', '--max-polls', '1']);
  assert.equal(r.code, 3, r.out);
});
