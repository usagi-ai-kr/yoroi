#!/usr/bin/env python3
"""CI 실행 범위 분류기.

- rename(-M)은 old/new 경로를 모두 포함한다. 코드가 docs로 이동해도 docs-only가 아니다.
- 초기 push(zero SHA)/SHA 누락/빈 diff/git 오류/manual은 보수적으로 full=true다.
- 변경 파일은 git diff에서 얻는다(GitHub API 페이지 제한과 무관).
- 설명문서: docs/** + 루트 README.md·AGENTS.md·CLAUDE.md. 스킬은 별도 스코프다.
"""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC_FILES = {"README.md", "AGENTS.md", "CLAUDE.md"}
SKILL_PREFIX = ".agents/skills/"
ZERO_SHA = "0" * 40


def is_doc(name):
    return name.startswith("docs/") or name in DOC_FILES


def diff_files(repo, spec):
    result = subprocess.run(
        ["git", "-C", str(repo), "diff", "--name-status", "-z", "-M", spec],
        capture_output=True)
    if result.returncode:
        return None
    tokens = result.stdout.decode().split("\0")
    names, index = set(), 0
    while index < len(tokens):
        status = tokens[index]
        if not status:
            index += 1
            continue
        size = 3 if status[0] in "RC" else 2
        if index + size > len(tokens):
            return None
        names.update(tokens[index + 1:index + size])
        index += size
    return sorted(name for name in names if name)


def classify(files, full, reason):
    return {
        "docs_only": bool(files) and not full and all(is_doc(name) for name in files),
        "skills": full or any(name.startswith(SKILL_PREFIX) for name in files),
        "link_scope": full or any(is_doc(name) for name in files),
        "full": full,
        "reason": reason,
        "files": files,
    }


def range_result(repo, reason, spec):
    files = diff_files(repo, spec)
    if files is None:
        return classify([], True, "git-error")
    if not files:
        return classify([], True, "empty-diff")
    return classify(files, False, reason)


def resolve(args):
    repo = Path(args.repo).resolve()
    if args.event == "pull_request":
        if not args.base or not args.head:
            return classify([], True, "missing-pr-sha")
        return range_result(repo, "pull_request", f"{args.base}...{args.head}")
    if args.event == "push":
        if not args.before or not args.after or args.before == ZERO_SHA:
            return classify([], True, "initial-push")
        return range_result(repo, "push", f"{args.before}..{args.after}")
    if args.base and args.head:
        return range_result(repo, "pull_request", f"{args.base}...{args.head}")
    return classify([], True, "manual")


def main():
    parser = argparse.ArgumentParser(description="CI 변경 범위 분류")
    parser.add_argument("--repo", default=str(ROOT))
    parser.add_argument("--event", default="manual", choices=["manual", "pull_request", "push"])
    parser.add_argument("--base")
    parser.add_argument("--head")
    parser.add_argument("--before")
    parser.add_argument("--after")
    parser.add_argument("--github-output")
    args = parser.parse_args()
    result = resolve(args)
    print(json.dumps(result, ensure_ascii=False))
    if args.github_output:
        with open(args.github_output, "a", encoding="utf-8") as out:
            for key in ("docs_only", "skills", "link_scope", "full"):
                out.write(f"{key}={'true' if result[key] else 'false'}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
