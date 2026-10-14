#!/usr/bin/env python3
"""토큰 절약 digest: 보고·패킷·상태를 화면 읽기 없이 압축하고 호출 수를 센다(로스터·워크스페이스는 coord_workspace 기준)."""
import argparse, json, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import coord_herdr as H
import coord_workspace as W

def main():
    parser = argparse.ArgumentParser(description="compact digest without screen reads")
    parser.add_argument("labels", nargs="*")
    parser.add_argument("--roster", default="docs/orchestration.md")
    parser.add_argument("--reports", nargs="*", default=[])
    parser.add_argument("--packets", nargs="*", default=[])
    parser.add_argument("--herdr", default="herdr")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    herdr_calls = 0
    screen_reads = 0

    def run(cmd):
        nonlocal herdr_calls
        herdr_calls += 1
        try:
            return subprocess.run([args.herdr, *cmd], capture_output=True, text=True, timeout=60)
        except OSError:
            return None

    try:
        entries = W.parse_entries(args.roster)
    except (FileNotFoundError, W.WorkspaceError):
        entries = []
    roster, workspace_of, ambiguous = {}, {}, set()
    for entry in entries:
        if entry.label in roster and roster[entry.label] != entry.pane: ambiguous.add(entry.label)
        else: roster.setdefault(entry.label, entry.pane); workspace_of.setdefault(entry.label, entry.workspace)
    agents = {}
    if roster:
        proc = run(["agent", "list"])
        if proc is not None and proc.returncode == 0:
            try:
                for item in json.loads(proc.stdout)["result"]["agents"]:
                    agents[item.get("pane_id")] = item
            except Exception:
                pass
    labels = args.labels or sorted(roster)
    report_map = {}
    if len(args.reports) == len(labels):
        report_map = dict(zip(labels, args.reports))
    elif args.reports:
        report_map["*"] = args.reports

    def digest_report(path):
        path = Path(path)
        if not path.is_file():
            return {"path": str(path), "missing": True}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            return {"path": str(path), "error": str(exc)}
        return {"path": str(path), "task_id": data.get("task_id"), "status": data.get("status"),
                "modified": len(data.get("modified_files") or []), "verified": len(data.get("verification_results") or [])}

    report_digests = [digest_report(path) for path in (report_map.get("*") or [])]
    label_rows = []
    for label in labels:
        fresh = label in workspace_of and label not in ambiguous
        pane = "?" if label in ambiguous else roster.get(label, "?")
        agent = agents.get(pane, {})
        report_path = report_map.get(label) or (H.last_report(workspace_of[label], label) if fresh else None)
        row = {"label": label, "pane": pane, "status": H.status_of(agent) if agent else "missing",
               "report": digest_report(report_path) if report_path else None}
        label_rows.append(row)
    packet_digests = []
    for path in args.packets:
        try:
            packet_digests.append({"path": path, **{key: json.loads(Path(path).read_text(encoding="utf-8")).get(key)
                for key in ("task_id", "target_pane", "report_path")}})
        except Exception as exc:
            packet_digests.append({"path": path, "error": str(exc)})

    payload = {"labels": label_rows, "reports": report_digests, "packets": packet_digests,
               "calls": herdr_calls, "screen_reads": screen_reads}
    if args.json:
        print(json.dumps(payload, ensure_ascii=False))
    else:
        for row in label_rows:
            report = row.get("report") or {}
            print(f"{row['label']} {row['pane']} {row['status']} " +
                  (f"report={report.get('task_id') or report.get('path')} modified={report.get('modified', 0)} " +
                   f"verified={report.get('verified', 0)}" if report else "report=-"))
        for report in report_digests:
            print(f"report {report.get('task_id') or report.get('path')} modified={report.get('modified', 0)} verified={report.get('verified', 0)}")
        for packet in packet_digests:
            print(f"packet {packet.get('task_id')} -> {packet.get('report_path')}")
        print(f"calls={herdr_calls} screen_reads={screen_reads}")

if __name__ == "__main__":
    sys.exit(main())
