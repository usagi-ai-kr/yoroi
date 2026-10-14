#!/usr/bin/env python3
"""추적·신규 파일과 스킬을 검증한다. Git 초기화·staging·외부 패키지 불필요."""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCEPTIONS = {
    "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "uv.lock", "poetry.lock",
    "Cargo.lock", "Gemfile.lock", "go.sum", "gradlew", "gradlew.bat",
}
CI_EXCLUDED_DOCS = {"README.md", "AGENTS.md", "CLAUDE.md"}


def ci_excludes_content(name):
    """--ci에서 내용(줄 수) 검사만 제외할 설명문서. 스킬은 제외 대상이 아니다."""
    return name.startswith("docs/") or name in CI_EXCLUDED_DOCS


def file_list():
    with tempfile.TemporaryDirectory(prefix="yoroi-validation-") as directory:
        command = ["git"]
        if not (ROOT / ".git").exists():
            subprocess.run(["git", "init", "--quiet", directory], check=True)
            command += [f"--git-dir={directory}/.git", f"--work-tree={ROOT}"]
        result = subprocess.run(
            command + ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            cwd=ROOT, capture_output=True, check=True,
        )
        return sorted(set(result.stdout.decode().split("\0")) - {""})


def main():
    ci = "--ci" in sys.argv[1:]
    errors = []
    files = file_list()
    for name in files:
        path = ROOT / name
        if path.is_symlink():
            if not path.exists():
                errors.append(f"{name}: broken symlink")
            continue
        if not path.is_file():
            errors.append(f"{name}: tracked file missing; stage deletion if intended")
            continue
        if ci and ci_excludes_content(name):
            continue
        data = path.read_bytes()
        if b"\0" in data or path.name in EXCEPTIONS:
            continue
        try:
            content = data.decode("utf-8")
        except UnicodeDecodeError:
            continue
        count = len(content.splitlines())
        if count > 100:
            errors.append(f"{name}: {count} lines > 100")

    validator = ROOT / ".agents/skills/skill-authoring/scripts/validate.sh"
    skills = sorted(path for path in (ROOT / ".agents/skills").iterdir() if path.is_dir())
    for skill in skills:
        check = subprocess.run(["bash", str(validator), str(skill), "100"], cwd=ROOT)
        if check.returncode:
            errors.append(f"{skill.relative_to(ROOT)}: skill validation failed")

    portable = ROOT / ".agents/skills/skill-authoring/scripts/check-portability.sh"
    if portable.exists():
        check = subprocess.run(["bash", str(portable), str(ROOT / ".agents/skills")], cwd=ROOT)
        if check.returncode:
            errors.append("skills: portability check failed (프로젝트 고유 값이 스킬에 남아 있음)")

    labels = json.loads((ROOT / ".github/labels.json").read_text())
    names = [label["name"] for label in labels]
    if len(names) != len(set(names)):
        errors.append("labels.json: duplicate names")
    for label in labels:
        if not re.fullmatch(r"[0-9a-fA-F]{6}", label["color"]) or not label["description"]:
            errors.append(f"labels.json: invalid label {label['name']}")
    for error in errors:
        print(f"ERROR: {error}")
    print(f"{'FAIL' if errors else 'PASS'}: {len(files)} files, {len(skills)} skills")
    return bool(errors)


if __name__ == "__main__":
    raise SystemExit(main())
