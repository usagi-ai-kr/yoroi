#!/usr/bin/env python3
"""coord digest 필수 경로: 화면 읽기 0, 호출 수 측정."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
DIGEST = Path(__file__).resolve().parent / "coord_digest.py"
FAKE = r'''#!/usr/bin/env python3
import json, os, sys
state = json.load(open(os.environ["FAKE_STATE"])) if os.path.exists(os.environ["FAKE_STATE"]) else {}
args = sys.argv[1:]
if args[:2] == ["agent", "list"]:
    state["list_calls"] = state.get("list_calls", 0) + 1
    json.dump(state, open(os.environ["FAKE_STATE"], "w"))
    agents = [{"pane_id": "w12:p11", "agent": "fake", "agent_status": "done", "state_change_seq": 7}]
    json.dump({"result": {"agents": agents}}, sys.stdout); sys.exit(0)
if args[:2] == ["agent", "read"]:
    state["read_calls"] = state.get("read_calls", 0) + 1
    json.dump(state, open(os.environ["FAKE_STATE"], "w"))
    print("Build auto · Fake · max"); sys.exit(0)
sys.exit(2)
'''
def prepare(tmp):
    (tmp / "herdr").write_text(FAKE); os.chmod(tmp / "herdr", 0o755)
    (tmp / "roster.md").write_text("| pane | 라벨 | 역할 |\n| --- | --- | --- |\n| `w12:p11` | w3 | 워커 |\n")
    (tmp / "report.json").write_text(json.dumps({"task_id": "t3", "modified_files": ["a"], "verification_results": ["v1", "v2"]}))
def run(tmp, argv, roster="roster.md"):
    env = dict(os.environ, FAKE_STATE=str(tmp / "state.json"))
    return subprocess.run([sys.executable, str(DIGEST), *argv, "--roster", str(tmp / roster), "--herdr", str(tmp / "herdr")], cwd=tmp, env=env, capture_output=True, text=True)
def main():
    with tempfile.TemporaryDirectory() as folder:
        tmp = Path(folder); prepare(tmp)
        result = run(tmp, ["w3", "--reports", str(tmp / "report.json"), "--json"])
        assert result.returncode == 0, result.stderr + result.stdout
        data = json.loads(result.stdout)
        state = json.loads((tmp / "state.json").read_text()) if (tmp / "state.json").is_file() else {}
        assert data["calls"] == 1 and data["screen_reads"] == 0, data
        assert data["labels"][0]["report"]["task_id"] == "t3", data
        assert state.get("read_calls", 0) == 0 and state.get("list_calls") == 1, state
        print("ok: digest calls=1, screen_reads=0, report digest")
        text = run(tmp, ["w3", "--reports", str(tmp / "report.json")]).stdout
        assert "calls=1 screen_reads=0" in text, text
        print("ok: digest text count line")
        (tmp / "two.md").write_text("| pane | 라벨 | 역할 |\n| --- | --- | --- |\n| `w12:p11` | w3 | 워커 |\n| `w15:p9` | w3 | 워커 |\n| `w12:p0` | w2 | 워커 |\n")
        two = run(tmp, ["w3", "w2", "--json"], roster="two.md")
        rows = {row["label"]: row for row in json.loads(two.stdout)["labels"]}
        assert rows["w3"]["pane"] == "?" and rows["w2"]["pane"] == "w12:p0", two.stdout
        print("ok: 여러 workspace 같은 라벨은 추측하지 않음(?)")
    print("PASS: coord digest 필수 경로 테스트 통과")
    return 0
if __name__ == "__main__":
    sys.exit(main())