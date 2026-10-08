#!/usr/bin/env python3
"""작업 중단 체크포인트를 생성·검증한다. 표준 라이브러리와 git만 사용한다."""
import argparse
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SECRET_PATTERNS = [re.compile(p) for p in (
    r"sk-[a-zA-Z0-9_-]{20,}", r"ghp_[a-zA-Z0-9]{36,}", r"github_pat_[a-zA-Z0-9_]{40,}",
    r"AKIA[0-9A-Z]{16}", r"-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----",
    r"Bearer\s+[a-zA-Z0-9_\-\.]{20,}",
)]
STATUSES = ("완료", "실패", "중지", "확인필요")
SECTIONS = ("## 상태: 재개 금지", "## 중단 사유", "## Git", "## 진행 중이던 작업",
            "## 미실행 단계", "## 재개 조건")


def git(*args, cwd="."):
    result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else "(git 정보 없음)"


def parse_inflight(items):
    parsed, errors = [], []
    for item in items:
        name, _, status = item.rpartition("=")
        if not name.strip() or status.strip() not in STATUSES:
            errors.append(f"--inflight 형식 오류: '{item}' (<작업>=<{'|'.join(STATUSES)}>)")
        else:
            parsed.append((name.strip(), status.strip()))
    return parsed, errors


def render(args, inflight, cwd="."):
    bullet = lambda items: "\n".join(f"- {i}" for i in items) or "- 없음"
    status = git("status", "--short", cwd=cwd) or "(변경 없음)"
    return "\n".join([
        "# 작업 중단 체크포인트", "",
        f"생성: {datetime.now(timezone.utc).isoformat(timespec='seconds')}", "",
        "## 상태: 재개 금지", "",
        "사용자가 명시적으로 재개를 요청하기 전에는 아래 후속 단계를 실행하지 않는다.", "",
        "## 중단 사유", "", args.reason, "",
        "## Git", "",
        f"- 브랜치: {git('branch', '--show-current', cwd=cwd)}",
        f"- HEAD: {git('rev-parse', 'HEAD', cwd=cwd)}",
        "- 미커밋 변경(보존):", "", "```text", status, "```", "",
        "## 진행 중이던 작업", "", bullet(f"{n}: {s}" for n, s in inflight), "",
        "## 미실행 단계", "", bullet(args.pending), "",
        "## 재개 조건", "", args.resume, "",
    ])


def check_text(text):
    errors = [f"필수 섹션 누락: {s}" for s in SECTIONS if s not in text]
    if any(p.search(text) for p in SECRET_PATTERNS):
        errors.append("보안 위반: 시크릿/개인키 패턴 검출")
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    create = sub.add_parser("create")
    create.add_argument("out")
    create.add_argument("--reason", required=True)
    create.add_argument("--inflight", action="append", default=[])
    create.add_argument("--pending", action="append", default=[])
    create.add_argument("--resume", default="사용자의 명시적 재개 요청")
    create.add_argument("--force", action="store_true")
    sub.add_parser("check").add_argument("path")
    args = parser.parse_args(argv)
    if args.cmd == "check":
        path = Path(args.path)
        errors = check_text(path.read_text(encoding="utf-8")) if path.is_file() else [f"파일 없음: {path}"]
    else:
        out = Path(args.out)
        inflight, errors = parse_inflight(args.inflight)
        if out.exists() and not args.force:
            errors.append(f"이미 존재: {out} (덮어쓰려면 --force)")
        if not errors:
            text = render(args, inflight)
            errors = check_text(text)
            if not errors:
                out.write_text(text, encoding="utf-8")
    for error in errors:
        print(f"ERROR: {error}")
    print("FAIL" if errors else "PASS: 중단 체크포인트 유효")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
