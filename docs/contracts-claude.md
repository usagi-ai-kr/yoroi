# Claude Code CLI 사용량 명령 계약

- 확인일: 2026-10-07
- 대상: Claude Code CLI (`claude`)
- 버전: 2.1.292 (`/Users/young-mini/.local/bin/claude`)
- 실행 명령: `claude -p /usage`
- 관련 이슈: `#17`, `#22`

## 1. 실행 명령 및 호출 계약

- 실행 계약: `executable: 'claude'`, `args: ['-p', '/usage']`.
- 사용자 확인 및 실행 검증:
  - `claude -p /usage` 호출이 모델 호출 없이 세션/주간 사용량 조회를 반환함을 확인.
  - 종료 코드: 성공 시 0, 비정상 시 nonzero.
  - 표준 출력: 평문 텍스트 블록. 표준 에러는 빈 값 유지.

## 2. 실제 출력 구조 및 필드 사양

실제 CLI 출력의 주요 라인 패턴은 다음과 같다:

| 항목 | 라인 패턴 | 추출 필드 | 매핑 ID |
| --- | --- | --- | --- |
| 5시간 세션 | `Current session: (\d+)% used` | used percent | `session:5h` |
| 주간 전체 | `Current week (all models): (\d+)% used · resets ...` | used percent | `weekly:7d` |
| 주간 Sonnet | `Current week (Sonnet only): (\d+)% used` (선택적) | used percent | `weekly:sonnet:7d` |

## 3. 파싱 및 도메인 매핑 규칙

- ANSI 및 locale: 평문 텍스트이며 ANSI escape 코드 정규식 제거 후 매칭.
- 윈도우 단위: `unit: 'percent'`, 추출된 퍼센트 값을 `UsageWindow.percent`에 매핑.
- 최소 1개 이상의 유효 윈도우(`session:5h` 또는 `weekly:7d`)가 파싱되어야 정상 처리.
- 평문 reset은 날짜·시간대 표기가 가변적이므로 현재 resetAt으로 추정 변환하지 않는다.

## 4. 오류 정규화

- nonzero exit: `SourceError('exit')`.
- 인증 실패: 출력 내 `/login`, `login`, `authenticate`, `unauthorized` 등 감지 시 `SourceError('authentication')`.
- 포맷 불일치: 세션/주간 패턴 미발견 또는 비정상 수치 시 `SourceError('parse')`.

## 5. 구현 상태

- 어댑터: `src/infra/claude-source.ts`
- 파서: `src/infra/cli-usage-parser.ts` (`parseClaudeUsage`)
- 테스트: `tests/claude.test.ts`, `tests/cli-usage.test.ts`
- Fixture: `tests/fixtures/claude-usage.txt` (실제 구조 보존 합성값)
