#!/usr/bin/env python3
"""하위 작업 패킷(Task Packet)을 생성·검증하는 CLI 유틸리티 (파일 경로 입력 필수)."""
import json, math, re, sys
from pathlib import Path

SECRET_PATTERNS = [re.compile(p) for p in (
    r"sk-[a-zA-Z0-9_-]{20,}", r"ghp_[a-zA-Z0-9]{36,}", r"github_pat_[a-zA-Z0-9_]{40,}",
    r"AKIA[0-9A-Z]{16}", r"-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----",
    r"Bearer\s+[a-zA-Z0-9_\-\.]{20,}"
)]


def is_non_empty_str(val) -> bool:
    return isinstance(val, str) and bool(val.strip())


def has_secret(text: str) -> bool:
    return any(p.search(text) for p in SECRET_PATTERNS)


def validate_packet(data) -> list[str]:
    errors = []
    if not isinstance(data, dict):
        return ["패킷 최상위는 JSON 객체(dict)여야 합니다."]
    for key in ("task_id", "target_pane"):
        if not is_non_empty_str(data.get(key)):
            errors.append(f"{key}는 비어있지 않은 문자열이어야 합니다.")
    for key in ("owned_files", "completion_criteria"):
        val = data.get(key)
        if not isinstance(val, list) or not val:
            errors.append(f"{key}는 비어있지 않은 배열이어야 합니다.")
        elif not all(is_non_empty_str(item) for item in val):
            errors.append(f"{key}의 각 항목은 비어있지 않은 문자열이어야 합니다.")
    if "report_path" in data and not is_non_empty_str(data["report_path"]):
        errors.append("report_path는 비어있지 않은 문자열이어야 합니다.")
    timeout = data.get("timeout_minutes", 10)
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)):
        errors.append("timeout_minutes는 숫자(분 단위)여야 합니다.")
    elif math.isnan(timeout) or math.isinf(timeout) or timeout <= 0 or timeout > 10:
        errors.append(f"timeout_minutes({timeout})는 1~10분 단위 정책과 일치해야 합니다 (장기는 분리).")
    if has_secret(json.dumps(data, ensure_ascii=False)):
        errors.append("보안 위반: 패킷 내용 중 잠재적 시크릿/개인키 패턴 검출")
    return errors


def make_packet(task_id: str, pane: str, files: list[str], crit: list[str],
                report_path: str | None = None) -> dict:
    return {
        "task_id": task_id, "target_pane": pane, "timeout_minutes": 10,
        "owned_files": files, "completion_criteria": crit,
        "report_path": report_path or f"tmp/{task_id}-report.json",
        "report_format": "{task_id, modified_files:[str], verification_results:[str], provenance:{worker_actions:str|[str]}}",
        "on_stop": "새 작업 중지, 실행 중 외부 쓰기는 완료만 확인, 변경 보존 후 보고",
        "forbidden_actions": [
            "unowned_file_modification", "raw_secret_exposure",
            "git_mutation_without_permission", "redundant_real_api_call"
        ]
    }


def main():
    if len(sys.argv) < 2:
        print("사용법: task_packet.py [validate <file.json> | create <id> <pane> <files,...> <criteria,...> [report_path]]")
        return 2
    cmd = sys.argv[1]
    if cmd == "validate":
        if len(sys.argv) < 3:
            print("ERROR: 파일 경로 누락 (파일 경로 입력 필수)"); return 2
        path = Path(sys.argv[2])
        if not path.is_file():
            print(f"ERROR: 파일 없음: {path} (파일 경로 입력 필수)"); return 1
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"ERROR: JSON 파싱 실패: {e}"); return 1
        errors = validate_packet(data)
        if errors:
            for err in errors: print(f"ERROR: {err}")
            return 1
        print(f"PASS: 유효한 작업 패킷: {data.get('task_id')}"); return 0
    elif cmd == "create":
        if len(sys.argv) < 6:
            print("ERROR: create 인수 부족: <id> <pane> <files,...> <criteria,...>"); return 2
        task_id, pane = sys.argv[2], sys.argv[3]
        files = [f.strip() for f in sys.argv[4].split(",") if f.strip()]
        crit = [c.strip() for c in sys.argv[5].split(",") if c.strip()]
        report = sys.argv[6] if len(sys.argv) > 6 else None
        packet = make_packet(task_id, pane, files, crit, report)
        errors = validate_packet(packet)
        if errors:
            for err in errors: print(f"ERROR: 생성 검증 실패: {err}")
            return 1
        print(json.dumps(packet, ensure_ascii=False, indent=2)); return 0
    print(f"알 수 없는 명령: {cmd}"); return 2


if __name__ == "__main__":
    sys.exit(main())
