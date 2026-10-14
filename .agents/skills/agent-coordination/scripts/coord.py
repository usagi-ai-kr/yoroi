#!/usr/bin/env python3
"""분배 CLI: status·packet·send·audit·watch (계약: docs/insights/coord-cli.md 인터페이스 절)."""
import json, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import coord_herdr as H
import coord_workspace as W
from task_packet import validate_packet


def take(args, name, default=None):
    if name not in args: return default
    index = args.index(name)
    if index + 1 >= len(args) or args[index + 1].startswith("--"): print(f"ERROR: {name} 값 누락"); sys.exit(2)
    value = args[index + 1]; del args[index:index + 2]; return value


def delegate(script, args):
    return subprocess.run([sys.executable, str(HERE / script), *args]).returncode


def resolver(entries, workspace, cwd):
    """label → (workspace, pane). --workspace가 없으면 접두 규칙으로 정하고, 못 정하면 추측 대신 오류."""
    def pane_in(label: str) -> tuple[str, str]:
        chosen = W.pick_workspace(entries, workspace, cwd, label)
        return chosen, W.resolve_label(entries, label, chosen)
    return pane_in


def cmd_packet(args, pane_in):
    if len(args) < 4: print("사용법: coord.py packet <task_id> <label> <owned,...> <criteria,...> [report]"); return 2
    task_id, label, owned, criteria = args[:4]
    return delegate("task_packet.py", ["create", task_id, pane_in(label)[1], owned, criteria, *args[4:5]])


def cmd_send(herdr, args, pane_in, interval, wait_max, start_max):
    """전송 규칙: 패킷 검증→working 대기→1회 전송→시작 확인→로그(workspace 포함). 재전송하지 않는다."""
    if len(args) != 2: print("사용법: coord.py send <label> <packet.json>"); return 2
    label, packet_path = args
    workspace, pane = pane_in(label)
    packet = json.loads(Path(packet_path).read_text(encoding="utf-8"))
    errors = validate_packet(packet)
    if errors or packet.get("target_pane") != pane:
        for error in errors: print(f"ERROR: {error}")
        print(f"ERROR: 패킷 무효 또는 target_pane({packet.get('target_pane')}) != {pane} — 전송하지 않음")
        return 2
    report = packet.get("report_path")
    agent, why = H.wait_state(herdr, pane, lambda item: H.status_of(item) != "working", interval, wait_max)
    if why == "missing": print(f"ERROR: 로스터 갱신 필요 — {pane} 없음"); return 2
    if why == "timeout":
        H.log_send(workspace, label, pane, packet_path, report, "timeout", None)
        print(f"ERROR: 대기 초과({wait_max}s) — 전송하지 않음"); return 3
    if H.status_of(agent) in ("blocked", "unknown"):
        H.log_send(workspace, label, pane, packet_path, report, "blocked_refused", agent.get("state_change_seq"))
        print("ERROR: 사용자 조치 필요 — 메신저에 전달, 전송하지 않음"); return 1
    seq = agent.get("state_change_seq")
    ok, error = H.prompt(herdr, pane, H.send_message(packet_path, packet))
    if not ok:
        H.log_send(workspace, label, pane, packet_path, report, "prompt_failed", seq)
        print(f"ERROR: prompt 실패 — 실패로 기록: {error}"); return 1
    started = lambda item: H.status_of(item) in ("working", "blocked") or (seq is not None and item.get("state_change_seq") != seq)
    agent, why = H.wait_state(herdr, pane, started, 0.2, start_max)
    if why is not None:
        H.log_send(workspace, label, pane, packet_path, report, "not_started", seq)
        print("not_started" if why == "timeout" else f"ERROR: 로스터 갱신 필요 — {pane} 없음")
        return 1 if why == "timeout" else 2
    H.log_send(workspace, label, pane, packet_path, report, "turn_started", agent.get("state_change_seq"))
    print(f"turn_started seq {seq}→{agent.get('state_change_seq')}"); return 0


def main(argv):
    args = list(argv)
    herdr = take(args, "--herdr", "herdr")
    roster_doc = take(args, "--roster", "docs/orchestration.md")
    workspace = take(args, "--workspace")
    if not args: print(__doc__); return 2
    command = args.pop(0)
    try:
        if command == "audit":
            if len(args) != 2: print("사용법: coord.py audit <packet.json> <report.json>"); return 2
            return delegate("report_audit.py", args)
        entries = W.parse_entries(roster_doc)
        cwd = str(Path.cwd())
        pane_in = resolver(entries, workspace, cwd)
        if command == "packet": return cmd_packet(args, pane_in)
        if command == "status": return H.cmd_status(herdr, entries, W.pick_workspace(entries, workspace, cwd))
        if command == "send":
            limits = [float(take(args, "--interval", "5")), float(take(args, "--wait-max", "600")), float(take(args, "--start-max", "15"))]
            return cmd_send(herdr, args, pane_in, *limits)
        if command == "watch": return H.cmd_watch(herdr, pane_in, args)
    except W.WorkspaceError as error:
        print(f"ERROR: {error}"); return 2
    except (H.HerdrError, OSError, ValueError, KeyError) as error:
        print(f"ERROR: {error}"); return 1
    print(f"알 수 없는 명령: {command}"); return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
