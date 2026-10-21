#!/usr/bin/env python3
"""coord assess pane-report 1:1 대조 회귀: terminal pane 자신의 보고서가
missing일 때만 REPORT_MISSING, working pane의 부재는 POLL 유지."""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from coord_completion_state import assess

GOOD = {"task_id": "t", "status": "done"}


def agents_of(*pairs):
    return [{"pane_id": pane, "agent_status": status} for pane, status in pairs]


class PairFixTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def report(self, name, payload=GOOD):
        path = os.path.join(self.tmp.name, name)
        if payload is not None:
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(payload, handle)
        return path

    def test_done_ready_plus_working_missing_stays_poll(self):
        ready = self.report("a.json")
        missing = os.path.join(self.tmp.name, "b.json")
        verdict = assess(agents_of(("A", "done"), ("B", "working")),
                         ["A", "B"], [ready, missing], now=1000.0)
        self.assertEqual(verdict["decision"], "POLL")

    def test_done_missing_reports_immediately(self):
        missing = os.path.join(self.tmp.name, "a.json")
        ready = self.report("b.json")
        verdict = assess(agents_of(("A", "done"), ("B", "working")),
                         ["A", "B"], [missing, ready], now=1000.0)
        self.assertEqual(verdict["decision"], "REPORT_MISSING")
        self.assertIn("A", verdict["detail"])

    def test_all_ready_and_stale_policy_kept(self):
        ready_a = self.report("a.json")
        ready_b = self.report("b.json")
        verdict = assess(agents_of(("A", "done"), ("B", "idle")),
                         ["A", "B"], [ready_a, ready_b], now=1000.0)
        self.assertEqual(verdict["decision"], "REPORT_READY")
        stale = os.path.join(self.tmp.name, "c.json")
        with open(stale, "w", encoding="utf-8") as handle:
            handle.write("{oops")
        verdict = assess(agents_of(("A", "done")), ["A"], [stale], now=1000.0)
        self.assertEqual(verdict["decision"], "STALE_REPORT")


if __name__ == "__main__":
    unittest.main()
