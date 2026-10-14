# Cursor 요금제 출처 (이슈 #119)

- 출처: https://cursor.com/pricing
- 수집 시점: 2026-10-12 (카탈로그 `checkedOn = 2026-10-12`, `CHECKED_ON_DOCS` 모델은 2026-10-13)
- 플랜 ID: `cursor`, 표시 이름: `Cursor`
- 모델: `grok-4-7`, `grok-4-6`, `grok-4-5`, `composer-2-5` (`modelId`는 AA 정규화 이름)
- 과금: `billing: 'pool'`. 타사 모델은 Cursor 경유 API 정가 기준이며, `plan-catalog.ts`에는 Cursor 자체 모델만 둔다(병기 금지).
- 주간 풀: Plus 기본·Premium 4배·Super 15배·Ultra 50배. 정확한 세부 한도 수치는 pricing 페이지 재확인 전 `usageLimit`으로 단정하지 않는다.
- xAI usage (#132 통합): xAI usage 원천·읽기 전용 수집과 사용량 소스 저장 규약은 별도 작업. 결과가 없으면 기존 0점/미표시 규칙을 따른다.
- Grok Bot/X Premium 부가 혜택은 레터 요금제 설명에 1줄로만 적는다.