# Arena 코딩 단위D1 기록 (#190)

진단 행 + 계통 분리 단위. 기록 스키마·레터·카탈로그 변경 없음.
전체 이슈 완료가 아니다.

## N1 — 발행일 없는 행

- `toRecord`가 undefined이던 조용한 버림을 진단 행으로 바꿨다.
- `arena-coding <subset>: missing leaderboard_publish_date`.
- 검증은 거부 수로 집계한다(섞이면 ok + rejectedRows).

## N2 — 에러 없는 부분 수집

- `status: partial`인데 error가 없어도 진단을 남긴다.
- `arena-coding <subset>: partial subset`.
- source id·metric·observedAt 동작은 그대로다.

## 계통 분리

- `arena-coding` 저장·조회는 `MemoryInsightHistory` 실경로로 검증한다.
- 생산 history 코드는 손대지 않았다.
- arena overall 흉내 행은 검증에서 거부돼 승격되지 않는다.
- 구 `arena` 소스는 현 history 키 검증을 통과하지 못한다(읽기 전용
  잔여분과 신규 수집이 섞일 자리가 없다).

## 검증

- 집중 7/7 (기존 5 + 진단 1 + 계통 1).
- `pnpm run typecheck` clean. `python3 scripts/validate-repo.py` PASS.
- `git diff --check` clean. 파일 100줄 이하. 커밋·push·이슈 없음.
