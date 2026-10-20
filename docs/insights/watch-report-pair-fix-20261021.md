# watch 보고 판정 1:1 수정 (2026-10-21)

- 원인: `assess`가 done/idle pane 존재 + 어느 보고서든 missing이면
  MISSING으로 단정했다 (w1 done+보고서 ready인데도 w1 REPORT_MISSING 발생).
- 수정: `panes[i]`와 `reports[i]`를 1:1로 대조해 terminal pane 자신의
  보고서가 missing일 때만 즉시 `REPORT_MISSING`한다.
  working 중인 pane의 부재는 POLL을 유지한다.
- 진짜 done+missing 즉시 포착은 그대로. READY/DEADLINE/STALE 정책 유지.
  budget 로직은 손대지 않았다.
- 회귀 3건: done+ready / working+missing → POLL,
  done+missing / working+ready → MISSING, READY+STALE 유지.
