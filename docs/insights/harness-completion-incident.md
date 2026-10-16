# 완료 감지 하네스 개선 — watch 보고 누락 즉시 반환 (w1, `yoroi-harness-completion-code-w1`, 2026-10-16)

- 사건: w1 done·PR #170 MERGED·main CI 38861070165 success인데 report JSON 미수신 → watch/sleep 반복 대기.
- 원인(코드): `coord watch`가 BLOCKED/NEW/LIMIT만 감지 — pane이 terminal(done/idle)인데 보고서가 없어도 계속 폴링했다. 재호출마다 폴 카운트가 새로 시작돼 **누적 상한이 없었다**.
- 원칙: **상태(done)는 성공 근거가 아니고, 보고서 없음은 실패 단정이 아니다** — 상황별 다음 행동을 명시 신호로 분리한다.

## 구현 (최소)

- 신규 `.agents/skills/agent-coordination/scripts/coord_completion.py`(98줄, 레포 값 없음) — **실제 진입점 연결**: `coord_herdr.cmd_watch` → `C.run_watch`.
  - `REPORT_READY`: 보고서 존재·JSON 파싱 OK·task_id 일치(최근 send 패킷 기준) → 수신 완료(exit 0).
  - `REPORT_MISSING reconcile_now`: 감시 pane이 done/idle인데 보고서 없음 → **즉시 반환(exit 4)**, 대기 연장·재전송 금지.
  - `WATCH_DEADLINE`: 최초 `turn_started` 기록 시각 + 누적 1800초 초과 → exit 5. 재호출해도 동일(리셋 불가).
  - `STALE_REPORT`: 보고서 파싱 실패/타 task_id → exit 6(성공 아님).
  - `POLL`: 위임 전 남은 예산으로 `--max-polls` 상한을 계산 — bash watch가 누적 상한을 넘지 못한다.
- `coord_herdr.py`(98줄): `cmd_watch`가 `C.run_watch`로 위임, exit 0/3이면 재판정해 신호를 정정(구조화 상태 `agent_status` 사용, 화면 문구 grep 비의존).
- `coord.py`·`watch_workers.sh`는 수정하지 않음(최소 변경 — bash는 유한 폴링·exit 3 유지, 상한은 파이썬에서 부과).
- **계약 변경(문서 담당 w2 전달)**: watch 신호 4종·exit 4/5/6 추가, 새 플래그 없음(누적 예산 상수 1800s), 기존 0/2/3 의미 유지.

## 회귀 (`tests/coord-completion.test.ts`, fake herdr·clock·temp fixture)

- done+보고서 없음 → `REPORT_MISSING` 즉시(<5초)·exit 4 ✔
- task 일치 보고서 → `REPORT_READY` ✔ / 타 task → `STALE_REPORT` exit 6 ✔
- working + 예산 초과 → `WATCH_DEADLINE` exit 5, **2회 연속 호출에도 동일(리셋 없음)** ✔
- working·send 기록 없음 → 위임 watch 유한 종료 exit 3 ✔

## 검증

- 신규 TS **5/5 PASS** · 기존 python coord 테스트 4종 PASS(회귀 없음) · typecheck PASS ·
  스킬 validate PASS·portability 위반 0 · validate-repo PASS(745 files·8 skills).
- 파일 줄 수: coord_completion 98 · coord_herdr 98 · test 90 (≤100).

## 보존·후속

- 패널·외부 pane/agent 상태 변경 없음(테스트는 fake herdr). 제품 source·package 1.0.3·dirty5 불변. issue·커밋·머지·릴리스는 이번 단계 없음.
- 후속: w2가 `docs/insights/coord-cli.md` 계약에 신호·exit 반영, 독립 리뷰. 보고 후 대기.
