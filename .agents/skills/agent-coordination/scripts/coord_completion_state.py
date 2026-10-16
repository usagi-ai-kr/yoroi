#!/usr/bin/env python3
"""coord watch 상태·예산 판정 헬퍼 (coord_completion 분리 모듈).
호스트 5분 규칙에 정합하도록 기본 누적 상한을 300초로 관리하며 재호출 리셋을 방지한다."""
import json, math, time
from datetime import datetime
from pathlib import Path

SEND_LOG = Path("scratch/coord-send.log")
TERMINAL = {"done", "idle"}
WATCH_BUDGET_S = 300.0
EXIT = {"REPORT_READY": 0, "REPORT_MISSING": 4, "WATCH_DEADLINE": 5, "STALE_REPORT": 6}

def log_records():
    if not SEND_LOG.is_file(): return []
    out = []
    for line in SEND_LOG.read_text(encoding="utf-8").splitlines():
        try: out.append(json.loads(line))
        except Exception: pass
    return out

def anchor_for(report_path):
    anchor, packet = None, None
    for record in log_records():
        if record.get("report_path") != report_path: continue
        packet = record.get("packet") or packet
        if record.get("result") == "turn_started" and anchor is None:
            try: anchor = datetime.fromisoformat(record.get("time", "")).timestamp()
            except Exception: anchor = None
    return anchor, packet

def expected_task(packet_path):
    if not packet_path or not Path(packet_path).is_file(): return None
    try: return json.loads(Path(packet_path).read_text(encoding="utf-8")).get("task_id")
    except Exception: return None

def report_state(report_path, expected):
    path = Path(report_path)
    if not path.is_file(): return "missing", "no file"
    try: data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as error: return "stale", f"parse: {error}"
    if not isinstance(data, dict): return "stale", "not a JSON object"
    if expected and data.get("task_id") != expected:
        return "stale", f"task_id {data.get('task_id')!r} != {expected!r}"
    return "ready", ""

def assess(agents, panes, reports, now=None):
    now = time.time() if now is None else now
    statuses = {a.get("pane_id"): a.get("agent_status", "unknown") for a in agents}
    terminal = [p for p in panes if statuses.get(p) in TERMINAL]
    states, remain = [], []
    for report in reports:
        anchor, packet = anchor_for(report)
        state, detail = report_state(report, expected_task(packet))
        if anchor is not None: remain.append(WATCH_BUDGET_S - (now - anchor))
        states.append({"report": report, "state": state, "detail": detail})
    poll_seconds = min(remain) if remain else None
    if states and all(s["state"] == "ready" for s in states):
        return {"decision": "REPORT_READY", "detail": " ".join(s["report"] for s in states), "poll_seconds": None}
    stale = next((s for s in states if s["state"] == "stale"), None)
    if stale: return {"decision": "STALE_REPORT", "detail": f"{stale['report']} {stale['detail']}", "poll_seconds": None}
    missing = [s for s in states if s["state"] == "missing"]
    if missing and terminal:
        return {"decision": "REPORT_MISSING", "detail": f"{' '.join(terminal)} done/idle; report absent", "poll_seconds": None}
    if poll_seconds is not None and poll_seconds <= 0:
        return {"decision": "WATCH_DEADLINE", "detail": f"budget {WATCH_BUDGET_S:.0f}s since first turn_started", "poll_seconds": 0.0}
    return {"decision": "POLL", "detail": "", "poll_seconds": poll_seconds}

def signal_line(verdict):
    line = {"REPORT_READY": "REPORT_READY", "REPORT_MISSING": "REPORT_MISSING reconcile_now",
            "WATCH_DEADLINE": "WATCH_DEADLINE budget_exceeded", "STALE_REPORT": "STALE_REPORT"}[verdict["decision"]]
    return line + (f" — {verdict['detail']}" if verdict.get("detail") else "")

def cap_polls(poll_seconds, interval, requested):
    interval = max(float(interval or 20), 0.05)
    return max(1, min(int(requested), int(math.ceil(max(poll_seconds, 0.0) / interval))))
