# 점수 소수점 두 자리 통일 (2026-10-21, #249)

## 범위
- 중앙 2줄: `unified.ts` scoreText `toFixed(1)→(2)`,
  `render.ts` scoreCell `String→toFixed(2)`.
  Free 칸·요약 선두·3역할 표는 자동 추종.
- `reviewer-policy`·`free-reviewer` 변경 없음(표시에 영향 없음).
- 원시 점수·순위·가중치·파레토 불변. `-`/`✗` 유지.

## 검증
- 역할 표·Top15·Free 셀·요약 2자리, BDD 단언 영향 없음.
- 비교는 기존 1자리 키(scoreKey·sortScore)로 분리해 파레토·정렬 불변.
  reviewer 키는 기존 2자리 그대로.
- 80.46/80.54 회귀: 표시 그대로·둘 다 파레토·id 순서.
- 워커 가산 +N.NN 통일(표시만, 계산 불변).
- 후속 sync 완료 6건(role-fit·orch-value·calibration·output·source-policy·unified).
- typecheck·validate·diff clean, 전체 `pnpm run check`는 보고서 수치.

## 재발행 위험
- 본문·댓글 점수 자리수만 바뀌고 값·순위는 동일.
