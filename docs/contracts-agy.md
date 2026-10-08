# AGY CLI 사용량 명령 계약

- 확인일: 2026-10-07
- 대상: Google Antigravity CLI (`agy`)
- 버전: 1.3.1 (`/Users/young-mini/.local/bin/agy`)
- 실행 명령: `agy -p /usage`
- 관련 이슈: `#16`, `#21`

## 1. 실행 명령 및 호출 계약

- 실행 계약: `executable: 'agy'`, `args: ['-p', '/usage']`.
- 사용자 확인 및 실행 검증:
  - `agy -p /usage` 호출이 모델 호출 없이 순수 상태 조회를 반환함을 확인.
  - 종료 코드: 성공 시 0, 비정상 시 nonzero.
  - 표준 출력: 탭 구분(TSV) 텍스트 테이블. 표준 에러는 빈 값 유지.

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

## 5. 구현 상태

- 어댑터: `src/infra/agy-source.ts`
- 파서: `src/infra/cli-usage-parser.ts` (`parseAgyUsage`)
- 테스트: `tests/agy.test.ts`, `tests/cli-usage.test.ts`
- Fixture: `tests/fixtures/agy-usage.txt` (실제 구조 보존 합성값)

## 6. 인증 경로 (현행)

- Yoroi는 토큰을 읽거나 저장하지 않는다. `agy -p /usage`의 인증은 CLI에 위임한다.
- 전용 auth resolver는 없다. 1.3.1 `--help`에는 login·auth 하위 명령이 없다. 로그인은 대화형 `agy`로 한다.
- 공식 설치 문서: 로컬은 OS 키링의 기존 OAuth를 silent sign-in으로 쓰고,
  Gemini API key 모드(`modelProvider: gemini`, `GEMINI_API_KEY`)는 계정 세션을 만들지 않는 별도 모델 API 모드다.
  구독 quota를 복구하는 경로가 아니다.
  [install](https://www.antigravity.google/docs/cli/install/)
- 공식 `/usage` 문서는 대화형 TUI 패널이며 백엔드에서 설정과 쿼터를 새로 갱신한다고 설명한다.
  `-p /usage`의 비대화형 계약은 문서화되어 있지 않다. [usage](https://www.antigravity.google/docs/cli/commands/usage/)

## 7. 미확인 호출 계약

- 키링 서비스·계정명, 자격 증명 파일 경로·형식. 키체인이나 파일은 열람하지 않았다.
- 바이너리 내부 RPC(`RetrieveUserQuotaSummary`, `FetchQuotaStatus`, `aicode.googleapis.com`)의 요청·응답 계약.
  정적 문자열로 존재만 확인했다. 공개 GET 계약으로 취급하지 않는다.
- 직접 인증 연동의 가능성은 있으나 저장소와 호출 계약이 확인되지 않았다. 현행 구현은 CLI 위임이다.
- 복구 절차(대화형 `agy`, 브라우저·SSH 로그인)는 [auth-recovery.md](auth-recovery.md)에 있다.
