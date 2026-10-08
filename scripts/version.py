#!/usr/bin/env python3
"""Yoroi 버전 CLI. 기본 read-only, bump는 dry-run, --apply에서만 manifest를 쓴다.

- 버전 원본은 manifest(package.json) 하나다. 새 버전 파일을 만들지 않는다.
- 엄격 SemVer X.Y.Z만 허용(선행 0·prerelease·build·Unicode 숫자 미지원). tag는 vX.Y.Z다.
- 자동 git commit/push/tag/Release는 하지 않는다. 발행 순서는 docs/versioning.md를 따른다.
"""
import argparse, json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "package.json"
ROADMAP = ROOT / "docs" / "roadmap.md"
SEMVER = re.compile(r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
MILESTONE = re.compile(r"\[([^\]\n]+milestone)\]\((https://[^)\s]+)\)")


def load(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("manifest 최상위가 JSON 객체가 아니다")
    version = data.get("version")
    if not isinstance(version, str) or not SEMVER.fullmatch(version):
        raise ValueError(f"invalid SemVer: {version!r} (X.Y.Z만 허용, prerelease/build 미지원)")
    return data, version


def read_version(path):
    return load(path)[1]


def bump(version, part):
    major, minor, patch = (int(value) for value in version.split("."))
    if part == "patch":
        return f"{major}.{minor}.{patch + 1}"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major + 1}.0.0"


def apply_bump(path, part):
    path = Path(path)
    data, before = load(path)
    data["version"] = bump(before, part)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return before, data["version"]


def milestones():
    try:
        text = ROADMAP.read_text(encoding="utf-8")
    except OSError:
        return []
    return MILESTONE.findall(text)


def main():
    parser = argparse.ArgumentParser(description="버전 조회와 승격(dry-run 기본)")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--bump", choices=["patch", "minor", "major"])
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        current = read_version(args.manifest)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}")
        return 1
    print(f"version: {current}")
    print(f"manifest: {args.manifest}")
    print(f"tag(예정): v{current}")
    found = milestones()
    print("milestones: " + (", ".join(f"{title} {url}" for title, url in found)
                            if found else "로컬 roadmap에서 미확인"))
    if args.bump is None:
        if args.apply:
            print("ERROR: --apply는 --bump와 함께 사용한다")
            return 2
        return 0
    target = bump(current, args.bump)
    if not args.apply:
        print(f"dry-run: {current} -> {target} (파일 변경 없음)")
        if current.startswith("0."):
            print("NOTE: 0.x는 초기 개발 단계다. 파괴 변경은 minor로, major는 1.0.0 안정 선언에 쓴다.")
        return 0
    try:
        before, after = apply_bump(args.manifest, args.bump)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}")
        return 1
    print(f"applied: {before} -> {after} (manifest만 변경, git 작업 없음)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
