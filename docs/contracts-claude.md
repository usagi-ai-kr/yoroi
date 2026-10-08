# Claude 사용량 조회 계약

- 확인일: 2026-10-08
- 대상: Claude 구독 사용량 (OAuth 읽기 전용 GET)
- 버전: 2.1.293 (`/Users/young-mini/.local/bin/claude` → `versions/2.1.293`)
- 자동 수집: `GET https://api.anthropic.com/api/oauth/usage`
- 관련 이슈: `#17`, `#22`

## 1. 자동 조회 계약

- 고정 GET 경로, Bearer OAuth·`anthropic-beta: oauth-2025-04-20`, 요청 body 없음.
- Claude CLI·모델 API·로그인·token refresh·credential 쓰기를 호출하지 않는다.
- 공식 CLI가 사용하는 내부 경로이며 공개 지원 API로 보장하지 않는다.
  발견 근거·인증 우선순위·실행 검증은 [claude-readonly.md](claude-readonly.md)에 기록한다.

| 응답 bucket | percent | resetAt | 매핑 ID |
| --- | --- | --- | --- |
| five_hour | utilization | resets_at | session:5h |
| seven_day | utilization | resets_at | weekly:7d |
| seven_day_sonnet | utilization | resets_at | weekly:sonnet:7d |
| seven_day_opus | utilization | resets_at | weekly:opus:7d |

- null/없는 bucket은 건너뛰며 최소 1개 유효 bucket이 필요하다. utilization은 유한 0–100 수치다.
- resets_at은 날짜가 유효하고 명시 시간대가 있는 ISO를 UTC로 정규화한다. 누락/null은 unknown이다.
  소수점 이하는 밀리초로 자르고 부족하면 0으로 채운다(`.1` → `.100`, `.1234` → `.123`).
- 비정상 bucket/reset은 parse 오류다. extra_usage의 비용을 사용률로 추정하지 않는다.

## 2. 수동 CLI 텍스트 호환 파서

아래는 사용자 표시 형식의 호환 파서 계약이다. 자동 조회에서 CLI를 실행하는 경로는 없다.

| 항목 | 라인 패턴 | 추출 필드 | 매핑 ID |
| --- | --- | --- | --- |
| 5시간 세션 | `Current session: (\d+(?:\.\d+)?)% used` (+ 선택적 `· resets …`) | percent, resetAt | `session:5h` |
| 주간 전체 | `Current week \(all models\): (\d+(?:\.\d+)?)% used` (+ 선택적 `· resets …`) | percent, resetAt | `weekly:7d` |
| 주간 Sonnet | `Current week \(Sonnet only\): (\d+(?:\.\d+)?)% used` (선택적) | percent, resetAt | `weekly:sonnet:7d` |

- `percent`는 0~100 실수. reset 표기는 있을 수도, 없을 수도 있다.
- ANSI escape 코드는 정규식 제거 후 매칭한다.

## 3. reset 표시 형식과 UTC 변환 계약

- 표시 형식(연도 생략): `<Month> <day> at <h>:<mm><am|pm> (<IANA zone>)`.
  예시(합성): `resets Oct 7 at 9:50pm (Asia/Seoul)`.
- 명시 연도도 지원한다: `<Month> <day>, <YYYY> at <h>:<mm><am|pm> (<IANA zone>)`.
- 월 이름은 영어 3글자(Jan–Dec) 또는 전체 이름이며 대소문자를 무시한다.
  시각은 12시간제 + am/pm, 분 생략 시 00분이다.
- 변환 결과는 UTC ISO 8601 문자열로 `UsageWindow.resetAt`에 넣는다.
- 연도 생략 시: `observedAt`을 해당 IANA zone으로 본 연도 `Y`를 기준으로
  `{Y-1, Y, Y+1}` 중 유효한 달력 날짜를 고르고 관측 지역 시각에 가장 가까운 날짜를 쓴다.
  (연말 경계와 막 만료된 reset을 함께 처리) 동률이면 미래 후보를 택한다.
- 시간대는 IANA 지역 이름과 `UTC`를 지원한다. UTC 오프셋(`+09:00`)·약어(`KST`)는 지원하지 않는다.
- DST: 현지 시각이 중복(가을 되돌림)이거나 존재하지 않으면(봄 건너뜀) reset을 제공하지 않는다.
- 무효 입력: 존재하지 않는 날짜(예: 2월 30일), 무효 IANA zone, 미지원 형식이면 reset을
  제공하지 않는다(추정 변환 금지).
- reset 미제공은 parse 오류가 아니다. `percent`를 그대로 보존하고 window는 `resetAt`
  없이 만든다. reset 표기 파싱 실패만으로 `SourceError('parse')`를 내지 않는다.

## 4. 오류 정규화

- 자동 조회의 인증 누락·만료·HTTP 401/403: authentication, 429/기타 실패 status: unavailable.
- timeout·cancel·network는 HTTP 경계에서 정규화하며 헤더·원문을 오류에 포함하지 않는다.
- 아래 인증/평문 규칙은 수동 텍스트 호환 파서에만 적용한다.
- 인증 실패: `/login`, `login`, `authenticate`, `unauthorized` 등 감지 시
  `SourceError('authentication')`.
- 포맷 불일치: 세션/주간 패턴 미발견 또는 비정상 수치 시 `SourceError('parse')`.
- reset 관련 실패는 오류가 아니며 위 3장의 미제공 정책을 따른다.

## 5. 구현 상태

- 어댑터: `src/infra/claude-source.ts`
- 자동 파서: `src/infra/claude-api-parser.ts`, 인증: `src/infra/claude-credentials.ts`
- 자동 조회 테스트: `tests/claude-api.test.ts`, `tests/claude-composition.test.ts`, 인증 경계 테스트·BDD
- 수동 텍스트 파서: `src/infra/cli-usage-parser.ts` (`parseClaudeUsage`)
- 시간대 변환: `src/infra/claude-reset.ts` (표준 Intl 사용, 추가 의존성 없음)
- 테스트: `tests/claude.test.ts`, `tests/claude-reset.test.ts`, `tests/cli-usage.test.ts`
- Fixture: `tests/fixtures/claude-usage.txt` (실제 구조 기반 합성값)
