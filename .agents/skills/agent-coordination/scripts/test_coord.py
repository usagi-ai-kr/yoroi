#!/usr/bin/env python3
"""coord CLI 필수 경로 테스트: 가짜 herdr 실행 파일 주입(실제 herdr 미사용)."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
SCRIPTS = Path(__file__).resolve().parent
COORD = SCRIPTS / "coord.py"
FAKE = r'''#!/usr/bin/env python3
import json, os, sys
state_path, scenario = os.environ["FAKE_STATE"], os.environ.get("FAKE_SCENARIO", "idle")
state = json.load(open(state_path)) if os.path.exists(state_path) else {}
args, pane = sys.argv[1:], "w12:p0"
def save(): json.dump(state, open(state_path, "w"))
if args[:2] == ["agent", "list"]:
    state["list_calls"] = state.get("list_calls", 0) + 1; save()
    status = "working" if scenario == "busy_then_idle" and state["list_calls"] <= 2 else scenario
    agents = [] if scenario == "missing_pane" else [{"pane_id": pane, "agent": "fake", "agent_status": status,
        "state_change_seq": state.get("seq", 10), "completion_seq": 0}]
    json.dump({"result": {"agents": agents}}, sys.stdout); sys.exit(0)
if args[:2] == ["agent", "read"]:
    print("Build auto · Fake Model · max" if scenario != "nomodel" else "fake pane text")
    print("1 shell · 25% · $0.18  ctrl+p commands"); sys.exit(0)
if args[:2] == ["agent", "prompt"]:
    state["prompts"] = state.get("prompts", 0) + 1
    if scenario == "prompt_fail": save(); sys.stderr.write('{"error": "agent_blocked"}'); sys.exit(1)
    if scenario != "seq_stuck": state["seq"] = state.get("seq", 10) + 1
    save(); json.dump({"result": {"ok": True}}, sys.stdout); sys.exit(0)
sys.exit(2)
'''
PACKET = {"task_id": "t1", "target_pane": "w12:p0", "timeout_minutes": 5, "owned_files": ["f.md"], "completion_criteria": ["c1"],
          "report_path": "tmp/t1-report.json", "requirements_doc": "docs/x.md", "forbidden_actions": ["git_mutation_without_permission"]}
def prepare(tmp):
    (tmp / "herdr").write_text(FAKE); os.chmod(tmp / "herdr", 0o755)
    (tmp / "roster.md").write_text("| pane | 이름 | 역할 |\n| --- | --- | --- |\n| `w12:p0` | w2 | 워커 |\n")
    (tmp / "packet.json").write_text(json.dumps(PACKET))
def run(tmp, scenario, argv, state=None):
    if state is not None: (tmp / "state.json").write_text(json.dumps(state))
    env = dict(os.environ, FAKE_SCENARIO=scenario, FAKE_STATE=str(tmp / "state.json"))
    command = [sys.executable, str(COORD), *argv, "--roster", str(tmp / "roster.md"), "--herdr", str(tmp / "herdr")]
    return subprocess.run(command, cwd=tmp, env=env, capture_output=True, text=True)
def send(tmp, extra=()): return ["send", "w2", str(tmp / "packet.json"), *extra]
def state_of(tmp): return json.loads((tmp / "state.json").read_text()) if (tmp / "state.json").is_file() else {}
def log_of(tmp): return (tmp / "scratch" / "coord-send.log").read_text(encoding="utf-8") if (tmp / "scratch" / "coord-send.log").is_file() else ""
def test_missing_label(tmp):
    result = run(tmp, "idle", ["send", "nope", str(tmp / "packet.json")])
    assert result.returncode == 2 and "후보" in result.stdout, result.stdout; print("ok: 라벨 미존재 exit 2")
def test_missing_pane(tmp):
    result = run(tmp, "missing_pane", send(tmp))
    assert result.returncode == 2 and "로스터 갱신" in result.stdout, result.stdout; print("ok: 로스터 pane 부재 exit 2")
def test_busy_then_idle(tmp):
    result = run(tmp, "busy_then_idle", send(tmp, ["--interval", "0.05", "--wait-max", "5", "--start-max", "2"]))
    assert result.returncode == 0 and "turn_started" in result.stdout and state_of(tmp).get("prompts") == 1, result.stdout
    print("ok: busy→idle 후 1회 전송·turn_started")
def test_blocked_refused(tmp):
    result = run(tmp, "blocked", send(tmp))
    assert result.returncode == 1 and "사용자 조치" in result.stdout and state_of(tmp).get("prompts") is None, result.stdout
    print("ok: blocked 거부 exit 1·전송 없음")
def test_prompt_fail_logged(tmp):
    result = run(tmp, "prompt_fail", send(tmp, ["--start-max", "0.3"]))
    assert result.returncode == 1 and "prompt 실패" in result.stdout, result.stdout
    assert "prompt_failed" in log_of(tmp) and "turn_started" not in log_of(tmp), log_of(tmp)
    print("ok: prompt 거부 exit 1·실패 기록(성공 아님)")
def test_seq_stuck_not_started(tmp):
    result = run(tmp, "seq_stuck", send(tmp, ["--start-max", "0.4"]))
    assert result.returncode == 1 and "not_started" in result.stdout and "not_started" in log_of(tmp), result.stdout
    print("ok: seq 미전진 not_started exit 1")
def test_wait_timeout(tmp):
    result = run(tmp, "working", send(tmp, ["--interval", "0.05", "--wait-max", "0.3"]))
    assert result.returncode == 3 and "대기 초과" in result.stdout and state_of(tmp).get("prompts") is None, result.stdout
    print("ok: working 대기 초과 exit 3·전송 없음")
def test_status_parsing(tmp):
    result = run(tmp, "idle", ["status"], state={"list_calls": 9})
    line = next((row for row in result.stdout.splitlines() if row.startswith("w2 ")), "")
    assert result.returncode == 0 and "Build auto · Fake Model · max" in line, result.stdout
    assert line.split()[:4] == ["w2", "w12:p0", "fake", "idle"], line
    nomodel = run(tmp, "nomodel", ["status"], state={"list_calls": 9})
    assert next((row for row in nomodel.stdout.splitlines() if row.startswith("w2 ")), "").endswith(" -"), nomodel.stdout
    print("ok: status 모델 줄 파싱(· 줄, 없으면 -)")

def main():
    tests = [test_missing_label, test_missing_pane, test_busy_then_idle, test_blocked_refused,
             test_prompt_fail_logged, test_seq_stuck_not_started, test_wait_timeout, test_status_parsing,
             test_watch_option_values]
    with tempfile.TemporaryDirectory() as folder:
        for index, test in enumerate(tests):
            tmp = Path(folder) / f"t{index}"
            tmp.mkdir(); prepare(tmp); test(tmp)
    print("PASS: coord CLI 필수 경로 테스트 통과")
    return 0
def test_watch_option_values(tmp):
    (tmp / "report.json").write_text("{}")
    result = run(tmp, "idle", ["watch", "w2", "--reports", str(tmp / "report.json"), "--interval", "0", "--max-polls", "1"])
    assert result.returncode in (0, 3), result.stdout + result.stderr
if __name__ == "__main__":
    sys.exit(main())
