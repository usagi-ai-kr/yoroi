# 리뷰어 점수·Free 정렬·jev 제외 분배 (2026-10-21)

- 이슈: #233. 사용자 결정: **리뷰어 스코어 0~100 통일**, Free 표에서 **jev 계열 제외**,
  Free 정렬 기준을 레터에 안내.
- 리뷰어 파레토 완화는 분포 진단 후 별도 판단한다. 이번 단위에서는 현행 유지.
- 기준: main `eef0430`(PR #237), dev `61e6c7d`. 최종 레터 #238.

## 계약 (w1)

1. **리뷰어 스코어 0~100**
   - `computeReviewerScore`의 가중합을 100배 해 0~100(소수 1자리)로 반환한다.
   - 가중치(성능 50%·속도 20%·가격 30%)·정렬·파레토 판정 기준은 바꾸지 않는다.
   - Free 리뷰어 칸도 0~100으로 표시한다.
   - 3역할 안내에 "리뷰어 스코어 = 0~100 가중합(성능 50%·속도 20%·가격 30%)"을 추가한다.
2. **Free 정렬 기준 안내**
   - 현재 `freeRowOrder` 기준(오케 통과 → 워커 통과 → 메신저 통과 → 나머지,
     각 점수 내림차순, 동점 모델명)을 Free 표 각주 1줄로 표시한다.
   - 정렬 알고리즘은 바꾸지 않는다.
3. **jev 계열 제외**
   - Free 티어 표 행에서 `jev` 접두 모델을 제외한다. 역할별 Top7/Top15 목록은 건드리지 않는다.
   - 다른 Free 행·정렬·점수는 불변이다.
4. **리뷰어 파레토**
   - 이번 단위에서는 계산·표시를 바꾸지 않는다. #229 기준 7행 중 1행만 표시된 원인
     (비용 결측/실제 지배) 진단은 후속 단위로 넘긴다.

## 소유 파일

`src/insights/letter-reviewer-policy.ts`, `src/composition/insights-free-reviewer.ts`,
`src/insights/letter-markdown-free.ts`, `src/insights/letter-three-role-legend.ts`,
필요 시 `src/composition/insights-reviewer-candidates.ts`, 관련 테스트,
`docs/insights/letter-display-fixes-20261021.md`.

## 검증·리뷰

- 2역할 경로 불변, 3/4역할 리뷰어·Free 표만 변경.
- 리뷰어 점수 0~100·Free 리뷰어 칸·정렬 각주·jev 제외 회귀.
- `pnpm run check`, typecheck, validate-repo, diff-check, 파일 100줄 이하.
- r(w18:p6) 독립 리뷰 PASS 후 커밋. 커밋·push는 오케스트레이터.
