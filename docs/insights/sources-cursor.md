# Cursor Plus 요금제 출처 (이슈 #119)

- 출처: https://cursor.com/pricing
- 확인일: 2026-10-14 (`checkedOn`)
- 보유 플랜: ID `cursor`, 표시 이름 Cursor Plus, $8/월.
- 모델: 기존 카탈로그의 `grok-4-7`, `grok-4-6`, `grok-4-5`를 유지한다. 가격 페이지는 Grok 전용 범위만 확인하고 버전별 ID는 열거하지 않는다.
- 세 버전 ID의 `verified` 표시는 2026-10-14 사용자 결정(기존 Grok 후보 유지·Cursor Plus 보유)에 따라 후보를 유지한다는 뜻이며, 가격 페이지에서 버전 ID를 확인했다는 의미는 아니다.
- 과금: Cursor와 Grok이 주간 사용량 풀을 공유한다. 모델은 `billing: 'pool'`, 플랜은 `sharedPoolPeriod: 'week'`로 기록한다.
- 주간 풀의 절대 한도는 공개되지 않는다. `UsageLimit.count`는 필수이고 레터도 횟수를 표시하므로 추정 숫자는 넣지 않고 `usageLimit`을 비운다.
- 타사 모델은 API 정가로 별도 청구되며 Plus에는 포함되지 않는다. Composer 2.5는 Plus 모델 목록에서 제외한다.
- 상위 등급 참고: Premium $30(4배), Super $100(15배), Ultra $200(50배). 별도 카탈로그 항목은 두지 않는다.
- xAI usage 수집(#132)은 별도 작업이며, Grok Bot/X Premium 레터 문구는 추가하지 않는다. 결과가 없으면 기존 0점/미표시 규칙을 따른다.
