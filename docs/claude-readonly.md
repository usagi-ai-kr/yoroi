# Claude 자동 조회 보강 (2026-10-08)

- 대상: [PR #28 재검토](https://github.com/qus0in/yoroi/pull/28#issuecomment-6050251014),
  [handle #29](https://github.com/qus0in/yoroi/issues/29).
- 문제: `-p /usage`의 출력 성공만으로 모델 요청 없는 실행을 증명할 수 없었다.
- 결정: 기본 5개를 유지하고 Claude만 고정 OAuth usage GET으로 교체한다.
  CLI·모델 요청·로그인·토큰 갱신·credential 쓰기·비용 기반 quota 추정 경로는 없다.
- 분담: AGY 인증 resolver, OpenCode API 어댑터·BDD·독립 계약 조사, Codex 조립·문서·통합.

## 근거와 범위

- [공식 CLI reference](https://code.claude.com/docs/en/cli-reference)는 `-p`를 SDK 질의로 설명한다.
  자동 반복에서 이 명령의 부작용 없음을 추정하지 않는다.
- 설치된 공식 CLI 2.1.293에서 `/api/oauth/usage` 경로를 정적으로 확인했다.
  내부 경로 사용이며 공개 지원 계약이나 장기 호환성을 보장하지 않는다.
- 클라이언트의 GET call site도 확인했으나 기존 CLI는 OAuth refresh를 지원한다.
  이번 구현은 기존 유효 accessToken만 읽고 갱신 경로를 포함하지 않는다.
- 변경된 source의 요청은 고정 GET·body 없음이다. 실패해도 CLI/모델 API로 fallback하지 않는다.
- HTTP는 redirect를 거부하며 1MiB 제한·timeout·취소·오류 정규화를 유지한다.

## 인증 우선순위와 격리

1. `YOROI_CLAUDE_OAUTH_TOKEN`, 다음 `CLAUDE_CODE_OAUTH_TOKEN` 명시값.
2. 명시값이 없으면 실행 계정의 기존 OAuth 저장소를 읽는다.
   macOS는 Keychain을 먼저 확인하고 유효 OAuth가 없으면 같은 프로필의 `.credentials.json`을 읽는다.
   다른 OS는 설정 디렉터리의 `.credentials.json`이다.
3. `CLAUDE_CONFIG_DIR`가 명시되면 해당 설정의 저장소만 읽는다. 기본은 HOME의 `.claude`다.
   macOS는 `CLAUDE_SECURESTORAGE_CONFIG_DIR` override·NFC 경로 해시·OS 계정을 적용한다.

- 명시값이 비어 있으면 다른 계정 저장소로 fallback하지 않는다.
- 저장 OAuth의 accessToken·만료만 확인한다. refreshToken을 실행하거나 값을 외부 기록에 포함하지 않는다.
- API key·Bedrock·Vertex·Foundry 인증은 구독 OAuth로 간주하지 않는다.
- 조사 시점 인증 모드는 환경마다 달랐다. worker는 claude.ai 로그인(firstParty), root는 `claude auth status` 기준 none(미로그인)이었다.
  두 환경 모두 조사한 인증·routing 환경 변수는 명시 설정이 없었다(모두 미설정). HOME은 기본값이었다.
- root의 기본 Keychain은 accessToken이 없고 만료 상태, 같은 HOME의 파일 OAuth는 유효했다.
  값은 기록하지 않았다. 누락/만료 Keychain → 같은 프로필 파일 조회를 합성 회귀 테스트로 보강했다.
- 과거 worker의 한도 출력과 root의 비용 출력 사이 차이의 단일 원인은 아직 확정하지 않았다.
  새 경로는 print/SDK 실행 조건에 의존하지 않으므로 그 차이로 모델 호출이 발생할 수 없다.

## 검증과 회고

- 합성 인증으로 누락·만료·잘못된 저장 형식·취소 및 선택 우선순위를 확인한다.
- production registry를 통한 once/watch에서 고정 usage GET만 기록하고 claude 프로세스 실행은 0회인지 검사한다. macOS Keychain의 `security` 읽기 호출만 허용된 예외다.
- BDD에서 2회 반복·GET/body 없음·인증 실패·HTTP 실패 격리와 reset 출력까지 확인한다.
- 실제 조회 시 토큰·원문은 메모리로만 처리하고 성공 여부·창 개수만 기록한다.
- CLI 옵션 이름·exit 0·출력 형식만으로 무모델 호출을 단정하지 않는다.
  자동 수집은 호출 가능한 외부 동작을 좁히고, 검증한 요청 경로를 근거로 설명한다.

## 최종 실행 검증 (root, 2026-10-08)

- 워커 초기 실행(1회): once exit 1, `authentication`, `security` 읽기 1회, GET 0회. watch 미실행.
- 최종 성공 실행: 루트가 실행하고 보고한 값이다. 워커가 재실행한 결과가 아니다.
  once exit 0, watch exit 0, watch 2 cycles, `GET /api/oauth/usage` 3회 모두 200, body 없음.
  `security` 읽기 3회, 금지 호출(refresh·claude 실행·쓰기) 0회.
- 초기 실패 원인은 루트 보고 기준 만료된 Keychain 항목이다. 같은 프로필의 유효한 파일 OAuth로 성공했다.
- 증거 감사 기록: `/tmp/yoroi-final-live-review.md`, `/tmp/yoroi-claude-live-readonly.md`(JSON).

## 내부 API 한계

- `/api/oauth/usage`는 Claude CLI가 쓰는 내부 경로이며 공개 지원 계약이 아니다.
  경로·헤더(`anthropic-beta`)·응답 형식은 예고 없이 바뀔 수 있다.
- 변경되면 parse 또는 unavailable로 격리되며 CLI나 모델 API로 대체하지 않는다.
- refresh를 하지 않으므로 만료된 accessToken은 authentication이다. CLI가 저장소를 갱신해야 회복된다.
- 실패 시 Claude 결과만 error로 남고, 다른 4개 공급자는 계속 조회된다.
