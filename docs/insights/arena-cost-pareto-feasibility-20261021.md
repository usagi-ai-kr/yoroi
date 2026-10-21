# Agent Arena 비용·Net Improvement 타당성 (2026-10-21, 구현 없음)

## 공식 근거 (확인 시각 2026-10-21)
- Agent 리더보드: https://arena.ai/leaderboard/agent
  Net Improvement(%±오차) · Cost/Task(P50, $) · 세션 수 ·
  카테고리(Overall·Code·Chat·Work) 표시 확인.
- HF `lmarena-ai/leaderboard-dataset` (CC-BY-4.0, parquet)는
  #190 코딩 계통과 같다. Agent 비용 계통과는 **별도 계통**이며
  혼합·중복 수집하지 않는다.
- 유료 스크래퍼 API(parse.bot 등)는 비공식이라 쓰지 않는다.
- ToS·재배포 범위: 미확인 (terms 페이지 직접 확인 불가).
  확인 전까지 자동 수집·재배포를 하지 않는다.

## 최소 필드·정의
- model identity + effort + category + asOf +
  netImprovement(%±margin) + costPerEligibleTaskP50($).
- 표본 수(세션 수)·기간(Active 필터)·단위($·%)·집계(P50·중위)를 함께 둔다.
- Work·Overall은 별도 승인 전 혼합 금지.

## 역할별 출력 (Yoroi 점수와 다른 척도)
- 오케: Net Improvement 순 + 비용 병기. 리뷰어: 저비용·고개선 파레토.
  워커: Cost/Task 낮은 순. 출처·범위를 분리 표기한다.
- effort 이름 자동 매핑 금지. #188 상한과 분리한다.

## 계약·실패·테스트
- last-good 유지, 부분 수집 표시, 삭제·수정·구조 변경 시 미제공.
- 합성 테스트: 결측·음수·동점·중복 이름·기간 불일치·표본 부족.

## 결론: 링크-only 권장
- ToS 미확인 + 공식 API 없음 → 자동 수집 없이 원문 링크·수동 참고로 종결.
- 도입은 ToS 확인 + 별도 승인 후.
