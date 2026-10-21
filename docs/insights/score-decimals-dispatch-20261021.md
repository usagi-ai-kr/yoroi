# 점수 소수점 두 자리 통일 분배 (2026-10-21)

- 이슈: #249. 표시 스코어를 모두 소수점 둘째 자리까지 고정한다.
- 원시 점수·순위·가중치·파레토 계산은 변경하지 않는다. 표시 문자열만 통일한다.

## 계약

- 예: `81.50`, `74.20`, `68.00`, `53.20`.
- 대상: 본문 Top7·Top15 댓글 역할 표, Free 표 오케/리뷰어/워커 칸, 요약 선두.
- `-`/`✗`/미확인 표기는 그대로. 0을 채우지 않는다.
- 2역할/3역할 모두 동일.
- 중앙 경로: `letter-top10-unified.ts`의 `scoreText`와 `letter-three-role-render.ts`의 `scoreCell`.
  필요하면 공용 `formatScore` helper로 묶는다.

## 소유·검증

- `src/insights/letter-top10-unified.ts`, `src/insights/letter-three-role-render.ts`,
  `src/insights/letter-reviewer-policy.ts`, 필요 시 `letter-markdown-tables.ts`,
  관련 테스트·`features/insights.feature`, `docs/insights/score-decimals-20261021.md`.
- 테스트: 역할 표·Top15·Free 셀·요약의 1자리 표기 제거, 원시 점수·순위 불변, 2역할/3역할.
- `pnpm run check`, typecheck, validate-repo, diff-check, 파일 100줄 이하.
- r(w18:p7) 리뷰 PASS 후 커밋·PR·오늘 재발행.
