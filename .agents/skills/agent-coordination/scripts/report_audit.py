#!/usr/bin/env python3
"""작업 결과 보고서 내용과 소유권·보안 준수 여부를 검사하는 감사 스크립트."""
import json, sys
from pathlib import Path

try:
    from task_packet import validate_packet, is_non_empty_str, has_secret
except ImportError:
    from .task_packet import validate_packet, is_non_empty_str, has_secret


def audit_report(packet_data, report_data) -> list[str]:
    pkt_errors = validate_packet(packet_data)
    if pkt_errors:
        return [f"기준 패킷 무효: {e}" for e in pkt_errors]
    if not isinstance(report_data, dict):
        return ["보고서 최상위는 JSON 객체(dict)여야 합니다."]

    errors = []
    owned = set(packet_data.get("owned_files", []))
    mod = report_data.get("modified_files")
    if not isinstance(mod, list) or not mod or not all(is_non_empty_str(f) for f in mod):
        errors.append("modified_files는 비어있지 않은 문자열 배열이어야 합니다.")
    else:
        unowned = set(mod) - owned
        if unowned:
            errors.append(f"소유권 보고 위반: 비소유 파일 수정 보고: {sorted(unowned)}")

    ver = report_data.get("verification_results")
    if not isinstance(ver, list) or not ver or not all(is_non_empty_str(v) for v in ver):
        errors.append("verification_results는 비어있지 않은 검증 결과 문자열 배열이어야 합니다.")

    prov = report_data.get("provenance")
    if not isinstance(prov, dict):
        errors.append("provenance는 객체(dict)여야 합니다.")
    else:
        act = prov.get("worker_actions")
        valid_act = is_non_empty_str(act) or (isinstance(act, list) and act and all(is_non_empty_str(a) for a in act))
        if not valid_act:
            errors.append("provenance.worker_actions는 비어있지 않은 문자열 또는 문자열 배열이어야 합니다.")

    raw_text = json.dumps(report_data, ensure_ascii=False)
    if has_secret(raw_text):
        errors.append("보안 보고 위반: 보고서 내용 중 잠재적 시크릿/개인키 패턴 검출")

    return errors


def main():
    if len(sys.argv) < 3:
        print("사용법: report_audit.py <task_packet.json> <report.json>"); return 2
    pkt_path, rep_path = Path(sys.argv[1]), Path(sys.argv[2])
    if not pkt_path.is_file() or not rep_path.is_file():
        print("ERROR: 입력 파일이 존재하지 않습니다. (파일 경로 입력 필수)"); return 1
    try:
        pkt = json.loads(pkt_path.read_text(encoding="utf-8"))
        rep = json.loads(rep_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"ERROR: JSON 로드 실패: {e}"); return 1

    errors = audit_report(pkt, rep)
    if errors:
        for err in errors: print(f"FAIL: {err}")
        return 1
    print(f"PASS: 작업 '{pkt.get('task_id')}' 보고서 내용 검사 통과 (자기신고 한계: 실제 워크트리 변경 대조 아님)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
