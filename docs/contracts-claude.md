# Claude Code CLI 사용량 명령 계약

- 확인일: 2026-10-08
- 대상: Claude Code CLI (`claude`)
- 버전: 2.1.293 (`/Users/young-mini/.local/bin/claude` → `versions/2.1.293`)
- 실행 명령: `claude -p /usage`
- 관련 이슈: `#17`, `#22`

## 1. 실행 명령 및 호출 계약

- 실행 계약: `executable: 'claude'`, `args: ['-p', '/usage']`.
- 종료 코드: 성공 시 0, 비정상 시 nonzero.
- 표준 출력: 평문 텍스트 블록. 표준 에러는 빈 값 유지.

## 2. 실제 출력 구조 및 필드 사양

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

- nonzero exit: `SourceError('exit')`.
- 인증 실패: `/login`, `login`, `authenticate`, `unauthorized` 등 감지 시
  `SourceError('authentication')`.
- 포맷 불일치: 세션/주간 패턴 미발견 또는 비정상 수치 시 `SourceError('parse')`.
- reset 관련 실패는 오류가 아니며 위 3장의 미제공 정책을 따른다.

## 5. 구현 상태

- 어댑터: `src/infra/claude-source.ts`
- 파서: `src/infra/cli-usage-parser.ts` (`parseClaudeUsage`)
- 시간대 변환: `src/infra/claude-reset.ts` (표준 Intl 사용, 추가 의존성 없음)
- 테스트: `tests/claude.test.ts`, `tests/claude-reset.test.ts`, `tests/cli-usage.test.ts`
- Fixture: `tests/fixtures/claude-usage.txt` (실제 구조 기반 합성값)
