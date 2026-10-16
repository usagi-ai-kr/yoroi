#!/usr/bin/env python3
"""coord watch 완료/보고 판정 보조 — pane 상태(done/idle)와 보고서 수신을 분리한다.
신호: REPORT_READY(수신 완료) / REPORT_MISSING reconcile_now(done/idle·보고서 없음 즉시)
/ WATCH_DEADLINE(누적 300초 예산 초과) / STALE_REPORT(파싱·task 불일치).
exit: READY=0, MISSING=4, DEADLINE=5, STALE=6, POLL timeout=3."""
import re, subprocess, sys, time
from coord_completion_state import (
    assess, signal_line, cap_polls, EXIT, WATCH_BUDGET_S, TERMINAL
)

LIMIT_PATTERN = r'Free usage exceeded|usage limit reached|quota (exceeded|exhausted)|retrying in [0-9]'

def run_watch(agent_list, herdr, panes, reports, options):
    """preflight + 폴링 루프: watch 중 working->done(no report) 전이도 다음 poll 즉시 반환."""
    interval = float(options.get("--interval", "20"))
    max_polls = int(options.get("--max-polls", "120"))
    tail_lines = int(options.get("--tail", "15"))
    limit_pat = options.get("--limit-pattern", LIMIT_PATTERN)

    init_verdict = assess(agent_list(herdr), panes, reports)
    if init_verdict["decision"] != "POLL":
        print(signal_line(init_verdict)); return EXIT[init_verdict["decision"]]
    if init_verdict["poll_seconds"] is not None:
        max_polls = cap_polls(init_verdict["poll_seconds"], interval, max_polls)

    for i in range(max_polls):
        if i > 0:
            if interval > 0: time.sleep(interval)
            agents = agent_list(herdr)
            verdict = assess(agents, panes, reports)
            if verdict["decision"] != "POLL":
                print(signal_line(verdict)); return EXIT[verdict["decision"]]
        else:
            agents = agent_list(herdr)

        blocked = [p for p in panes if any(a.get("pane_id") == p and a.get("agent_status") == "blocked" for a in agents)]
        if blocked:
            print(f"BLOCKED {time.strftime('%T')}")
            for p in blocked:
                print(f"--- {p}")
                res = subprocess.run([herdr, "agent", "read", p, "--source", "visible"], capture_output=True, text=True)
                for line in [l for l in res.stdout.splitlines() if l.strip()][-tail_lines:]:
                    print(line)
            return 0

        for p in panes:
            res = subprocess.run([herdr, "agent", "read", p, "--source", "visible"], capture_output=True, text=True)
            if re.search(limit_pat, res.stdout, re.IGNORECASE):
                print(f"LIMIT {p} {time.strftime('%T')}")
                return 0

    print(f"timeout: no change after {max_polls} polls", file=sys.stderr)
    return 3
