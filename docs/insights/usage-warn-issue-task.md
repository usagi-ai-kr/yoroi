# 사용률 warn 상태 이슈 (기록만)

- 이슈 [#164](https://github.com/qus0in/yoroi/issues/164) `feat: 사용률 90% 도달 시 warn 상태 추가` (label `feature`).
- 중복 확인: 열린 이슈 163(feat 레터 밴)·162(letter)·141(plan) — warn 상태와 동일 주제 없음 → 신규 생성.
- 기존 계약 차이: 현 `UsageStatus`는 under/optimal/over/n/a/limit, `limit`=98% 이상. warn(90%)은 미정의 → 우선순위·정규화·pretty/JSON 일관은 이슈 열린 질문으로 남김.
- 후속 범위: 임계 config·실 usage 조회 없음. 1.0.2 소스·config·docs 변경 0.
