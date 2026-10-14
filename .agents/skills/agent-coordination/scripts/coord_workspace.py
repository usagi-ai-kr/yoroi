#!/usr/bin/env python3
"""워크스페이스 해석: pane 접두(`w12:p0` → w12)로 라벨을 찾는다(계약: docs/insights/coord-cli.md 로스터 절)."""
import re
from pathlib import Path

ROW = re.compile(r"^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|", re.M)


class WorkspaceError(Exception):
    """워크스페이스·라벨 해석 실패(사용 오류 → exit 2)."""


class Entry:
    """로스터 행 하나: pane, workspace(접두), label(2열 첫 단어)."""
    __slots__ = ("workspace", "label", "pane")

    def __init__(self, pane: str, label: str):
        self.pane = pane
        self.workspace = pane.partition(":")[0]
        self.label = label.strip().split()[0]


def parse_entries(path: str) -> list[Entry]:
    """로스터 표(1열 백틱 pane, 2열 라벨)를 읽는다. 표가 비면 오류."""
    entries = [Entry(pane, label) for pane, label in ROW.findall(Path(path).read_text(encoding="utf-8"))]
    if not entries:
        raise WorkspaceError(f"로스터 표에 백틱 pane 행이 없음: {path}")
    return entries


def workspaces(entries: list[Entry]) -> list[str]:
    return sorted({entry.workspace for entry in entries})


def labels(entries: list[Entry], workspace: str) -> list[str]:
    return [entry.label for entry in entries if entry.workspace == workspace]


def _owners(entries: list[Entry], label: str) -> list[str]:
    return sorted({entry.workspace for entry in entries if entry.label == label})


def pick_workspace(entries: list[Entry], requested: str | None, cwd: str, label: str | None = None) -> str:
    """--workspace 검증 → 접두가 하나면 그 값 → cwd 경로 조각이 하나를 가리키면 그 값 → 그 밖은 오류(추측 금지)."""
    known = workspaces(entries)
    if requested is not None:
        if requested not in known:
            raise WorkspaceError(f"알 수 없는 workspace '{requested}': {'/'.join(known)}")
        return requested
    if len(known) == 1:
        return known[0]
    segments = set(Path(cwd).resolve().parts)
    matched = [workspace for workspace in known if workspace in segments]
    if len(matched) == 1:
        return matched[0]
    owners = _owners(entries, label) if label is not None else []
    if len(owners) > 1:
        raise WorkspaceError(f"ambiguous label '{label}': {'/'.join(owners)} — --workspace <id> 지정 필요")
    raise WorkspaceError(f"접두가 여러 개라 기본 workspace를 정할 수 없음: {'/'.join(known)} — --workspace <id> 지정 필요")


def resolve_label(entries: list[Entry], label: str, workspace: str) -> str:
    """그 workspace 안에서만 찾는다. 같은 라벨이 둘 이상이면 첫 번째를 고르지 않고 멈춘다."""
    mine = [entry for entry in entries if entry.label == label and entry.workspace == workspace]
    if len(mine) > 1:
        raise WorkspaceError(f"중복 라벨 '{label}' in {workspace}")
    if mine:
        return mine[0].pane
    owners = _owners(entries, label)
    if len(owners) > 1:
        raise WorkspaceError(f"ambiguous label '{label}': {'/'.join(owners)} — --workspace <id> 지정 필요")
    if owners:
        raise WorkspaceError(f"라벨 '{label}'은(는) {owners[0]}에만 있음(현재 workspace {workspace})")
    raise WorkspaceError(f"라벨 '{label}' 미존재 — 후보 라벨: {' '.join(labels(entries, workspace)) or '없음'}")


def pairs(entries: list[Entry], workspace: str) -> list[tuple[str, str]]:
    """status용 (라벨, pane) 목록(로스터 순서). 그 workspace의 중복 라벨은 오류."""
    seen, result = set(), []
    for entry in entries:
        if entry.workspace != workspace:
            continue
        if entry.label in seen:
            raise WorkspaceError(f"중복 라벨 '{entry.label}' in {workspace}")
        seen.add(entry.label)
        result.append((entry.label, entry.pane))
    return result
