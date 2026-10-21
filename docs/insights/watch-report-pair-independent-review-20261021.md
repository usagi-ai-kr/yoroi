# pane-report 1:1 감시 수정 독립 리뷰 (2026-10-21, w3)

- 범위: w1의 harness 변경 — `.agents/skills/agent-coordination/scripts/coord_completion_state.py`,
  신규 `scripts/test_coord_completion_state.py`, `SKILL.md`(버전 1.6). **읽기 전용 리뷰**(수정 없음).
- 판정: **PASS** (차단 사유 없음)

## 1. 변경 요약

`assess()` 의 "보고서 없음" 판정이 **전역 결합**(어느 pane 의 보고서든 missing + 어느 pane 든 terminal ⇒ REPORT_MISSING)에서
**pane-report 1:1 대조**로 바뀜. terminal pane **자신의** 보고서가 missing일 때만 즉시 보고하고,
working 중 pane의 보고서 부재는 POLL 유지.

```python
by_pane = dict(zip(panes, states))
terminal_missing = [p for p in terminal if p not in by_pane or by_pane[p]["state"] == "missing"]
```

## 2. 근거

1. **pane-report 1:1 대조 성립** ✓ — 호출부 `coord_herdr.cmd_watch` 가 `reports` 의 길이를 `labels` 와 같도록 강제하고
   (`len(reports) != len(labels)` ⇒ exit 2), 보고서 생략 시 라벨별 마지막 send 기록을 **같은 순서**로 만든다 ✓ → `zip(panes, states)` 정렬이 유지 ✓.
2. **타 worker working-missing 오탐 제거** ✓ — 이전에는 "working pane 의 보고서 아직 없음"이 다른 pane 의 done/idle 만으로 즉시 보고를 유발했다.
   신규 회귀 `test_done_ready_plus_working_missing_stays_poll` 이 POLL 유지로 못박는다 ✓.
3. **진짜 done-missing 은 즉시** ✓ — `test_done_missing_reports_immediately` ✓ (detail 에 해당 pane 표기 ✓).
4. **READY·DEADLINE·STALE 예산 유지** ✓ — 해당 분기 코드는 변경 없음(REPORT_READY 전수 ready → STALE_REPORT → WATCH_DEADLINE 300초 → POLL) ✓.
   `test_all_ready_and_stale_policy_kept` 가 READY/STALE 유지 ✓.
5. **판정 우선순위 보존** ✓ — READY 우선 → STALE → MISSING → DEADLINE → POLL 순서 그대로 ✓ (정상 흐름에서 예산이 조기 소진되지 않음 ✓).

## 3. Python 검증

- 신규 `test_coord_completion_state.py`: **3/3 통과** ✓ (작동 확인: unittest 3 tests OK).
- 기존 하네스 테스트 4종 재실행: `test_coord.py` · `test_coordination.py` · `test_coord_digest.py` · `test_coord_workspace.py` → **전부 PASS** ✓ (회귀 없음 ✓).

## 4. 권고 (차단 아님 · 소유 외 파일 → 보고만)

1. **위치 기반 대응을 문서화** — `--panes` 와 `--reports` 는 같은 순서로 1:1 이어야 한다. 현재 CLI 도움말·SKILL.md 에 명시가 없어,
   순서를 뒤섞으면 다른 pane 의 보고서로 오판할 수 있다 → `SKILL.md`/`coord_herdr.py` 도움말에 한 줄 명시 권고(소유 외 → 미수정, 보고만).
2. **STALE_REPORT 는 여전히 전역** — 어느 pane 의 보고서든 파싱·task_id 불일치면 즉시 알린다. pane-report 1:1 정책과 수준이 달라
   "내 pane 만" 제한이 필요하면 별도 결정 필요(현행 유지 판단) ✓.
3. `watch_workers.sh`(bash)는 자체 스냅샷 비교 방식이라 이번 판정 로직과 무관 ✓ (동작 변경 없음 ✓).

## 5. 미수행 (지시)

- 앱 전체 `pnpm run check` 미실행(다음 최종 단위 1회) ✓ · 커밋 없음 ✓ · 외부 쓰기 없음 ✓.
