#!/usr/bin/env python3
"""coord 워크스페이스 해석 테스트(p68): 접두 기본값·중복·모호 라벨·pane id 한정 확인."""
import json, os, subprocess, sys, tempfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
COORD = SCRIPTS / "coord.py"
FAKE = r'''#!/usr/bin/env python3
import json, os, sys
state_path = os.environ["FAKE_STATE"]
state = json.load(open(state_path)) if os.path.exists(state_path) else {}
def save(): json.dump(state, open(state_path, "w"))
args = sys.argv[1:]
if args[:2] == ["agent", "list"]:
    panes = state.get("panes", ["w12:p0", "w12:pR", "w15:p9", "w15:p1"])
    json.dump({"result": {"agents": [{"pane_id": pane, "agent": "fake", "agent_status": "idle",
        "state_change_seq": 1, "completion_seq": 0} for pane in panes]}}, sys.stdout); sys.exit(0)
if args[:2] == ["agent", "read"]:
    state.setdefault("reads", []).append(args[2]); save()
    print("Build auto · Fake Model · max"); sys.exit(0)
sys.exit(2)
'''
TWO = "| pane | label | model | role |\n| --- | --- | --- | --- |\n| `w12:p0` | w2 | A | 워커 |\n| `w15:p9` | w2 | B | 워커 |\n| `w12:pR` | o | A | 오케 |\n| `w15:p1` | o | B | 오케 |\n"
ONE = "| pane | label | role |\n| --- | --- | --- |\n| `w12:p0` | w2 | 워커 |\n"
DUP = "| pane | label | role |\n| --- | --- | --- |\n| `w12:p0` | w2 | 워커 |\n| `w12:p1` | w2 | 워커 |\n"


def setup(tmp):
    (tmp / "herdr").write_text(FAKE); os.chmod(tmp / "herdr", 0o755)
    (tmp / "two.md").write_text(TWO)
    (tmp / "one.md").write_text(ONE)
    (tmp / "dup.md").write_text(DUP)


def run(tmp, roster, argv, cwd=None):
    command = [sys.executable, str(COORD), *argv, "--roster", str(tmp / roster), "--herdr", str(tmp / "herdr")]
    env = dict(os.environ, FAKE_STATE=str(tmp / "state.json"))
    return subprocess.run(command, cwd=cwd or tmp, env=env, capture_output=True, text=True)


def state_of(tmp):
    path = tmp / "state.json"
    return json.loads(path.read_text()) if path.is_file() else {}


def test_duplicate_label_is_error(tmp):
    result = run(tmp, "dup.md", ["packet", "t1", "w2", "f.md", "c1"])
    assert result.returncode == 2 and "중복 라벨 'w2'" in result.stdout, result.stdout; print("ok: 같은 workspace 중복 라벨 exit 2")


def test_ambiguous_label_message(tmp):
    result = run(tmp, "two.md", ["packet", "t1", "o", "f.md", "c1"])
    assert result.returncode == 2 and "ambiguous label 'o': w12/w15" in result.stdout, result.stdout; print("ok: 모호 라벨은 첫 번째를 고르지 않고 exit 2")


def test_workspace_option_passes(tmp):
    for workspace, expected in (("w12", '"w12:pR"'), ("w15", '"w15:p1"')):
        result = run(tmp, "two.md", ["packet", "t1", "o", "f.md", "c1", "--workspace", workspace])
        assert result.returncode == 0 and expected in result.stdout, result.stdout
    unknown = run(tmp, "two.md", ["packet", "t1", "o", "f.md", "c1", "--workspace", "w99"])
    assert unknown.returncode == 2 and "알 수 없는 workspace 'w99'" in unknown.stdout, unknown.stdout
    print("ok: --workspace로 지정 통과, 모르는 workspace는 exit 2")


def test_single_label_unchanged(tmp):
    result = run(tmp, "one.md", ["packet", "t1", "w2", "f.md", "c1"])
    assert result.returncode == 0 and '"w12:p0"' in result.stdout, result.stdout; print("ok: 접두 하나면 기존과 같이 --workspace 없이 통과")


def test_other_workspace_only_label_is_refused(tmp):
    result = run(tmp, "two.md", ["packet", "t1", "w2", "f.md", "c1", "--workspace", "w99"])
    assert result.returncode == 2, result.stdout
    result = run(tmp, "one.md", ["packet", "t1", "o", "f.md", "c1"])
    assert result.returncode == 2 and "미존재" in result.stdout, result.stdout; print("ok: 다른 workspace 라벨·미존재 라벨은 exit 2")


def test_status_confirms_only_resolved_pane(tmp):
    result = run(tmp, "two.md", ["status", "--workspace", "w12"])
    assert result.returncode == 0 and "w12:pR" in result.stdout and "w15:p1" not in result.stdout, result.stdout
    reads = state_of(tmp).get("reads", [])
    assert reads and all(pane.startswith("w12:") for pane in reads), reads
    ambiguous = run(tmp, "two.md", ["status"])
    assert ambiguous.returncode == 2 and "workspace" in ambiguous.stdout, ambiguous.stdout
    print("ok: status는 지정 workspace pane만 확인(다른 workspace 같은 라벨 미확인)")


def main():
    tests = [test_duplicate_label_is_error, test_ambiguous_label_message, test_workspace_option_passes,
             test_single_label_unchanged, test_other_workspace_only_label_is_refused, test_status_confirms_only_resolved_pane]
    with tempfile.TemporaryDirectory() as folder:
        for index, test in enumerate(tests):
            tmp = Path(folder) / f"t{index}"
            tmp.mkdir(); setup(tmp); test(tmp)
    print("PASS: coord 워크스페이스 해석 테스트 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
