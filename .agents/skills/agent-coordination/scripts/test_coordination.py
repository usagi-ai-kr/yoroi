#!/usr/bin/env python3
"""에이전트 협업 스크립트 기능 및 경계 조건 회귀 테스트."""
import sys
from task_packet import validate_packet, make_packet
from report_audit import audit_report


def test_packet_validation():
    assert "JSON 객체" in validate_packet("not a dict")[0]
    assert any("task_id" in e for e in validate_packet({"task_id": ""}))
    for bad_t in (True, float("nan"), float("inf"), 15, -1):
        assert any("timeout_minutes" in e for e in validate_packet({
            "task_id": "t1", "target_pane": "p1", "owned_files": ["a"],
            "completion_criteria": ["c"], "timeout_minutes": bad_t
        }))
    # Secret rejection in packet
    assert any("보안 위반" in e for e in validate_packet(
        make_packet("t1", "p1", ["f1.ts"], ["ghp_" + "A" * 36])
    ))
    assert any("보안 위반" in e for e in validate_packet(
        make_packet("t1", "p1", ["f1.ts"], ["AKIA" + "1" * 16])
    ))
    assert any("보안 위반" in e for e in validate_packet(
        make_packet("t1", "p1", ["f1.ts"], ["-----BEGIN PRIVATE KEY-----\nMIIE..."])
    ))
    valid = make_packet("t1", "p1", ["f1.ts"], ["test_pass"])
    assert validate_packet(valid) == []
    assert valid["report_path"] == "/tmp/t1-report.json" and valid["on_stop"]
    assert any("report_path" in e for e in validate_packet(dict(valid, report_path="")))
    print("ok: packet validation rules passed")


def test_report_audit():
    pkt = make_packet("t1", "p1", ["f1.ts"], ["test_pass"])
    rep = {
        "task_id": "t1", "modified_files": ["f1.ts"],
        "provenance": {"worker_actions": "implemented"},
        "verification_results": ["PASS: test 1"]
    }
    assert audit_report(pkt, rep) == []

    # Unowned file modification reported
    bad_files = dict(rep, modified_files=["f1.ts", "unowned.ts"])
    assert any("소유권 보고 위반" in e for e in audit_report(pkt, bad_files))

    # Secret patterns: GitHub, AWS, PKCS#8, RSA
    for sec in ("ghp_" + "A" * 36, "AKIA" + "1" * 16,
                "-----BEGIN PRIVATE KEY-----\nMIIE...", "-----BEGIN RSA PRIVATE KEY-----\nMIIE..."):
        sec_rep = dict(rep, verification_results=[sec])
        assert any("보안 보고 위반" in e for e in audit_report(pkt, sec_rep))

    # Invalid provenance types without traceback
    for bad_act in ([], 123, None, ""):
        bad_prov = dict(rep, provenance={"worker_actions": bad_act})
        assert any("provenance" in e for e in audit_report(pkt, bad_prov))
    print("ok: report audit rules passed")


def main():
    test_packet_validation()
    test_report_audit()
    print("PASS: coordination script boundary tests passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
