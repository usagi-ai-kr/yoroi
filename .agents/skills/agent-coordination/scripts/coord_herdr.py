#!/usr/bin/env python3
"""coord CLI 지원 모듈: herdr 어댑터·폴링·상태·감시·전송 로그 (계약: docs/insights/coord-cli.md)."""
import json, re, subprocess, time
from datetime import datetime, timezone
from pathlib import Path
import coord_workspace as W
SEND_LOG = Path("scratch/coord-send.log"); HINTS = re.compile(r"ctrl\+|esc |for shortcuts|shift\+")
class HerdrError(Exception): pass
def run(herdr, args):
    try: return subprocess.run([herdr, *args], capture_output=True, text=True, timeout=60)
    except OSError as error: raise HerdrError(f"herdr 실행 실패: {error}")
def agent_list(herdr):
    proc = run(herdr, ["agent", "list"])
    try: agents = json.loads(proc.stdout)["result"]["agents"]
    except Exception: agents = None
    if proc.returncode != 0 or not isinstance(agents, list):
        raise HerdrError(f"herdr agent list 실패(exit {proc.returncode}): {(proc.stderr or '').strip()}")
    return agents
def status_of(agent): return (agent or {}).get("agent_status", "unknown")
def model_line(herdr, pane):
    """입력창 하단 모델 표시줄(· 포함 줄, 힌트 줄 제외). 없거나 read 실패면 '-'."""
    proc = run(herdr, ["agent", "read", pane, "--source", "detection"])
    lines = [text.strip() for text in proc.stdout.splitlines() if text.strip()] if proc.returncode == 0 else []
    candidates = [text for text in reversed(lines) if "·" in text and not HINTS.search(text)]
    return next((text for text in candidates if "auto ·" in text), candidates[0] if candidates else "-")
def prompt(herdr, pane, text):
    """prompt 1회 전송. (ok, err) — exit≠0 또는 오류 JSON이면 실패."""
    proc = run(herdr, ["agent", "prompt", pane, text])
    detail = (proc.stderr or "").strip() or (proc.stdout or "").strip()
    if proc.returncode != 0: return False, f"exit {proc.returncode}: {detail}"
    try: data = json.loads(detail) if detail else {}
    except Exception: data = {}
    if isinstance(data, dict) and data.get("error"): return False, json.dumps(data["error"], ensure_ascii=False)
    return True, ""
def wait_state(herdr, pane, done, interval, limit):
    """done(agent)가 참이 될 때까지 폴링. (agent,None)/(None,'missing')/(agent,'timeout')."""
    deadline = time.monotonic() + max(0.0, limit)
    while True:
        agent = next((item for item in agent_list(herdr) if item.get("pane_id") == pane), None)
        if agent is None: return None, "missing"
        if done(agent): return agent, None
        if time.monotonic() >= deadline: return agent, "timeout"
        time.sleep(max(0.0, interval))
def send_message(packet_path, packet):
    forbidden = ", ".join(packet.get("forbidden_actions") or []) or "-"
    return (f"작업 패킷 {packet_path} (task_id {packet.get('task_id', '-')}). requirements_doc "
            f"{packet.get('requirements_doc', '-')}. report_path {packet.get('report_path', '-')}. 금지: {forbidden}")
def log_send(workspace, label, pane, packet_path, report_path, result, seq):
    """성공·실패 모두 JSONL append(workspace_id 포함). 실패를 sent로 쓰지 않는다."""
    record = {"time": datetime.now(timezone.utc).isoformat(timespec="seconds"), "workspace": workspace, "label": label,
              "pane": pane, "packet": str(packet_path), "report_path": report_path, "result": result, "seq": seq}
    SEND_LOG.parent.mkdir(parents=True, exist_ok=True)
    with SEND_LOG.open("a", encoding="utf-8") as handle: handle.write(json.dumps(record, ensure_ascii=False) + "\n")
def last_report(workspace, label):
    """그 workspace·라벨에 마지막 send한 패킷의 report_path."""
    lines = SEND_LOG.read_text(encoding="utf-8").splitlines() if SEND_LOG.is_file() else []
    records = []
    for line in lines:
        try: records.append(json.loads(line))
        except Exception: pass
    return next((record.get("report_path") for record in reversed(records)
                 if record.get("workspace") == workspace and record.get("label") == label and record.get("report_path")), None)
def cmd_status(herdr, entries, workspace):
    """그 workspace 라벨별 `라벨 pane 에이전트 상태 모델표시줄` 한 줄. 로스터 밖 live는 라벨 ?."""
    rows = W.pairs(entries, workspace)
    by_pane = {agent.get("pane_id"): agent for agent in agent_list(herdr)}
    for label, pane in rows:
        agent = by_pane.get(pane)
        if agent is None: print(f"{label} {pane} - missing -")
        else: print(f"{label} {pane} {agent.get('agent', '-')} {status_of(agent)} {model_line(herdr, pane)}")
    for pane, agent in by_pane.items():
        if pane.startswith(f"{workspace}:") and pane not in {item[1] for item in rows}:
            print(f"? {pane} {agent.get('agent', '-')} {status_of(agent)} {model_line(herdr, pane)}")
    return 0
def cmd_watch(herdr, pane_in, args):
    """라벨->pane 뒤 watch 위임. watch 값은 보고 목록에 섞지 않는다."""
    index = args.index("--reports") if "--reports" in args else len(args)
    labels, rest = args[:index], args[index:]
    reports, options, i = [], {}, 0
    if rest and rest[0] == "--reports":
        i = 1
        while i < len(rest) and not rest[i].startswith("--"): reports.append(rest[i]); i += 1
    while i < len(rest):
        option = rest[i]
        if option not in ("--interval", "--max-polls", "--tail", "--limit-pattern"): print(f"ERROR: 알 수 없는 watch 옵션 {option}"); return 2
        if i + 1 >= len(rest) or rest[i + 1].startswith("--"): print(f"ERROR: {option} 값 누락"); return 2
        options[option] = rest[i + 1]; i += 2
    if not labels: print("사용법: coord.py watch <label...> [--reports <file...>]"); return 2
    resolved = [pane_in(label) for label in labels]
    panes = [pane for _, pane in resolved]
    reports = reports or [last_report(workspace, label) for (workspace, _), label in zip(resolved, labels)]
    reports = [report for report in reports if report]
    if len(reports) != len(labels): print("ERROR: 보고 경로 생략 시 각 라벨의 마지막 send 기록이 필요합니다"); return 2
    missing = [pane for pane in panes if pane not in {agent.get("pane_id") for agent in agent_list(herdr)}]
    if missing: print(f"ERROR: 로스터 갱신 필요 — {' '.join(missing)} 없음"); return 2
    script = str(Path(__file__).resolve().parent / "watch_workers.sh")
    command = ["bash", script, "--reports", *reports, "--panes", *panes, "--herdr", herdr]
    for option in ("--interval", "--max-polls", "--tail", "--limit-pattern"):
        if option in options: command += [option, options[option]]
    return subprocess.run(command).returncode
