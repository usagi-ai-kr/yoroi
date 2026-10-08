# Claude 운영 위험과 절차

- 기준일: 2026-10-08. 상세 조회 근거는 [claude-readonly.md](claude-readonly.md)에 있다.
- 이 문서는 운영 위험과 절차만 다룬다. 위험 수용이나 정책 승인은 기록하지 않는다.

## 1. 현행 경로

- 자동 수집: 고정 `GET https://api.anthropic.com/api/oauth/usage`, body 없음.
  Claude CLI·모델 API는 실행하지 않는다. 인증은 명시 토큰, macOS Keychain 읽기, 같은 프로필 파일 순서다.
- 직접 조회 채택: 사용자가 허가한 기술 선택으로 `claude -p /usage` 자동 수집을 고정 GET으로 교체했다.
  이는 기술 선택의 허가이며, 내부 API 위험 수용 선언이 아니다.
  기존 CLI 경로는 모델 무호출성을 확정하지 못했고, 환경별 응답 차이(#29)가 남아 있었다.

## 2. 위험 목록

| 항목 | 상태 | 현행 동작 |
| --- | --- | --- |
| 공개 지원 계약 | 없음 (확인됨) | 경로·헤더·응답이 바뀌면 `parse`/`unavailable`로 격리 |
| 공식 사용 허용 범위 | 미확인 | 공식 문서에 이 usage GET의 허용 범위가 없다. 확인 전까지 단정하지 않는다 |
| 자동 모델·CLI fallback | 없음 (코드 확인) | 실패해도 CLI나 모델 API로 대체하지 않는다 |
| 토큰 refresh | 없음 | 만료된 accessToken은 `authentication`이다 |
| API 429 | `unavailable` | `Retry-After`를 읽지 않고 backoff도 없다 |
| 인증 fallback과 cooldown | 분리됨 | 저장소 fallback은 API cooldown 회피를 보장하지 않는다 |
| 위험 수용 기록 | 없음 | 운영자의 수용 선언은 이 저장소에 기록되어 있지 않다 |

## 3. 로그인 만료 운영 절차

1. 증상: 해당 공급자가 `error [authentication]`로 표시되고 나머지 4개 공급자는 정상 조회된다.
2. 복구 절차(공식 `claude auth login`, 명시 토큰 위치 정정, AGY 대화형 로그인)는 [auth-recovery.md](auth-recovery.md)에 있다.
3. Yoroi는 로그인이나 refresh를 실행하지 않는다. 토큰 원문은 로그·이슈·문서에 쓰지 않는다.

## 4. 429와 cooldown

- 429는 현재 `unavailable`로만 매핑된다. backoff와 `Retry-After` 처리는 구현되어 있지 않다.
- cooldown 발생 위치(API 429, 로컬 저장소, CLI 로컬 제한)는 사용자 확인을 기다린다. 미확정이다.
- [공식 costs 문서](https://code.claude.com/docs/en/costs)는 plan-usage 조회 rate limit 때 60분 이내 마지막 값을 표시한다고 설명한다.
  이는 표시 freshness 기준이며 cooldown 길이가 아니다.
- `claude auth status`의 429·cooldown 계약은 [CLI reference](https://code.claude.com/docs/en/cli-reference)에서 확인되지 않았다.

## 5. 승인 상태

- PR #28 재검토 의견(6050713889): 조건부 승인 권고. 내부 API 위험의 명시적 기록을 요구했다.
  위험 수용 기록을 승인 조건으로 보는 견해는 검토자의 견해다.
- 운영자 위험 수용은 미확정이다. 이 저장소에 수용 선언이나 정책 승인 기록은 없다.
- #29는 별도 조사로 유지된다. 재검토 의견은 새 구조의 머지를 직접 차단하는 사유로 보지 않았다.
