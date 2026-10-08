# AGY CLI 사용량 명령 계약

- 확인일: 2026-10-07 (최종 보강: 2026-10-08)
- 대상: Google Antigravity CLI (`agy`)
- 버전: 1.3.1 (`/Users/young-mini/.local/bin/agy`)
- 실행 명령: `agy -p /usage`
- 관련 이슈: `#16`, `#21`

## 1. 실행 명령 및 호출 계약

- 실행 계약: `executable: 'agy'`, `args: ['-p', '/usage']`. PATH 기반 탐색.
- 사용자 확인 및 실행 검증:
  - `agy -p /usage` 호출이 모델 호출 없이 순수 상태 조회를 반환함을 확인.
  - 비대화형 호출 가능: 1.3.1에서 PTY 상호작용 없이 완료 확인. (단, 공식 문서 부재로 비공식 계약)
  - 종료 코드: 성공 시 0, 비정상 시 nonzero. 표준 에러는 빈 값 유지.
  - 지원 버전 정책: 1.3.1 실측 동작 기준. 하위/다중 버전 정책은 공식 문서 부재로 미검증.

## 2. 실제 출력 구조 및 필드 사양

실제 CLI 출력은 4개 탭 구분 컬럼으로 구성된다:

| 인덱스 | 필드명 | 형식/예시 | 설명 |
| --- | --- | --- | --- |
| 0 | Model Bucket | `Gemini Models`, `Claude and GPT models` | 모델 그룹 |
| 1 | Limit Window | `Weekly Limit Remaining`, `Five Hour Limit Remaining` | 윈도우 명칭 |
| 2 | Remaining | `\d+%` (예: `80%`) | 잔여 퍼센트 |
| 3 | Reset Time | ISO 8601 UTC (예: `2026-10-14T04:00:00Z`) | 리셋 일시 |

## 3. 파싱 및 도메인 매핑 규칙

- ANSI 및 locale: 평문 TSV이나 안전을 위해 ANSI escape 정규식 제거 적용.
- 윈도우 식별자: `${bucket-slug}:${window-slug}` (예: `gemini-models:weekly-limit-remaining`).
- 퍼센트 계산: 잔여량(remaining %)을 기반으로 `percent = 100 - remaining` 산출.
- 리셋 시각: 4번째 열의 ISO 8601 문자열을 `UsageWindow.resetAt`에 매핑.

## 4. 오류 정규화

- nonzero exit: `SourceError('exit')`.
- 인증 실패: 출력 내 `account ineligible`, `unauthenticated`, `login` 등 감지 시 `SourceError('authentication')`.
- 포맷 불일치: 4열 TSV 구조 누락 또는 윈도우 0개 시 `SourceError('parse')`.

## 5. 구현 상태 및 Fixture

- 어댑터: `src/infra/agy-source.ts`
- 파서: `src/infra/cli-usage-parser.ts` (`parseAgyUsage`)
- 테스트: `tests/agy.test.ts`, `tests/cli-usage.test.ts`
- Fixture (민감정보 제거 4종):
  - `tests/fixtures/agy-usage.txt`: 정상 TSV 성공
  - `tests/fixtures/agy-exhausted.txt`: 쿼터 소진 (remaining 0%, percent 100%)
  - `tests/fixtures/agy-unauthenticated.txt`: 미인증 에러
  - `tests/fixtures/agy-not-installed.txt`: 바이너리/명령 없음 에러

## 6. 인증 경로 (현행)

- Yoroi는 토큰을 읽거나 저장하지 않는다. `agy -p /usage`의 인증은 CLI에 위임한다.
- 전용 auth resolver는 없다. 1.3.1 `--help`에는 login·auth 하위 명령이 없다. 로그인은 대화형 `agy`로 한다.
- 공식 설치 문서: 로컬은 OS 키링의 기존 OAuth를 silent sign-in으로 쓰고,
  Gemini API key 모드(`modelProvider: gemini`, `GEMINI_API_KEY`)는 계정 세션을 만들지 않는 별도 모델 API 모드다.
  구독 quota를 복구하는 경로가 아니다. [install](https://www.antigravity.google/docs/cli/install/)
- 공식 `/usage` 문서는 대화형 TUI 패널이며 백엔드에서 설정과 쿼터를 새로 갱신한다고 설명한다.
  `-p /usage`의 비대화형 계약은 문서화되어 있지 않다. [usage](https://www.antigravity.google/docs/cli/commands/usage/)

## 7. 미확인 호출 계약 및 완료 기준 요약

- 미확인: 키링 파일/서비스명, 내부 RPC 계약(`RetrieveUserQuotaSummary` 등), 다중 버전 지원 정책.
- 완료 기준 판정: 1) 버전/탐색(부분: 1.3.1 실측, 다중버전 미검증), 2) 명령 확인(충족), 3) 비대화형(부분: 실측 성공, 공식문서 미검증),
  4) 복수 윈도우 매핑(충족), 5) ANSI/파싱 경계(충족), 6) Fixture 4종(충족), 7) 포맷 변경 테스트(충족).
- 복구 절차: [auth-recovery.md](auth-recovery.md).
