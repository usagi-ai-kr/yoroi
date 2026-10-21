# 메신저 UI U3a — 네 번째 독립 역할 (2026-10-21)

## 범위
- 순서 오케 → 리뷰어 → 워커 → 메신저, 라벨 `✉️ 메신저`.
  워커 라벨은 `🛠️ 워커`로 분리(검토 지시 반영).
  리포트 제목·o/r/w 빈 목록 표기는 불변.
- 메신저는 MECE 교대 배정 밖 독립 정렬(점수 내림차순).
  워커와 같은 모델 허용, o/r/w 출력 불변.
- composition은 `computeRoleList(records,'messenger',…)`로 만들고
  명시적 입력을 우선한다. 후보 없으면 섹션 생략.
- pipeline output에 `messengerPool`(컷 전 전체 eligible,
  reviewerPool 패턴)을 보존 — U3a-ii Free 4열 근거용.

## 불변
- 메신저 없으면 기존 3섹션 출력과 바이트 동일.
- o/r/w 빈 목록 표기 `(목록 없음)` 유지, 빈 메신저만 생략.
- Free 표·댓글 수·publish·워크플로·가중치 무변경.

## 검증
- typecheck·validate·diff clean, 전체 `pnpm run check`는 보고서 수치.
- 렌더(순서·라벨·depth·생략)·본문(4블록·생략)·파이프라인·선택·컴포지션 회귀.

## 다음 (U3a-ii / U3b)
- U3a-ii: Free 표 4열(오케·리뷰어·워커·메신저).
  `messengerPool`로 컷 밖 점수 사용 가능.
- U3b: 댓글 4개·publish 계약. `top7/top15` 댓글 맵은 o/r/w 유지됨.
- 미소유 충돌 2건 중 `reviewer-policy:79` 동기화 완료(U3a-b).
  잔여 1건: `tests/insights-composition.test.ts:97`(소유 미지정, 손대지 않음).
  `reviewer-composition`에는 제목 단언이 없어 변경 없음으로 확인.
  `LEGACY_WORKER`(2역할 교체용)는 유지.
