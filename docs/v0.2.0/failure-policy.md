# 공급자 상태·로그인 만료·복구 정책 (#39·#40, 설계 초안)

> 준비 단계: 설치·구현 금지. 근거: #31 계약 §4, `app/usage-source.ts`, `infra/*`.

## 1. 상태 모델 (#39)

- 상태: `ok`·`fetching`·`error`·`needs-login`·`stale`. 공급자별로 독립 판단.
- 기록 필드: `lastSuccessAt`·`lastErrorCode`·`snapshotAt`(신선도) 별도 보관.
- 연속 오류에도 마지막 정상 스냅샷을 유지하되 `stale`로 표시, 새 데이터처럼 노출 금지.
- `resetAt` 변경은 상태가 아닌 #31 `usage.resetChanged` 이벤트로 분리 기록.
- run↔공급자 매핑: run `running` 동안 수집 중 공급자는 `fetching`.
- run `completed`→성공분 `ok`(갱신), 실패분은 코드별 상태 유지.
- run `failed`→전체 `error` 유지, 마지막 정상은 `stale`로만 노출.
- run `interrupted`(재시작 마감)→해당 주기분 `stale`, 집계는 `completed`만.

## 2. 오류 코드 근거 (0.1.0 `SourceError`, 8종)

- `authentication`: claude/ollama/opencode-go `401·403`,
- codex `401·403`, `cli-usage-parser` 인증 패턴, 키·토큰 부재.
- 재시도 없음(#40): '로그인 필요' 표시, CLI 로그인 명령 자동 실행 금지.
- `timeout`·`network`(http-client)·`429`(opencode-go→`unavailable`)만 재시도 대상.
- `not-installed`·`parse`·`exit`: 재시도 없이 오류 이력만. `cancelled`는 상태 미기록.

## 3. 재시도·복구 정책 (#40)

- 제한 횟수 + 지수 backoff + 지터, 주기 수집(60초, #31 §2)을 넘지 않게 상한.
- 폭주 방지: 공급자별 직렬 1회, 동시 재시도 금지, 수집기 전체 타임아웃 유지.
- 격리: 한 곳 장애가 타 공급자·웹 UI·수집 루프를 중단하지 않음(부분 성공 저장).
- 복구: 첫 성공 시 `ok`로 전이 + `lastSuccessAt` 갱신, 연속 실패 카운터 초기화.
- #29 확정 전 Claude 자동 폴링 금지. 수동 복구: 토큰·키 재설정 후 `once` 1회 확인.

## 4. 이력·보안 원칙

- 이력에 남기는 것: 시각·`SourceErrorCode`·상태 전이·리셋 변경 여부만.
- 남기지 않는 것: 비밀값(토큰·키·OAuth)·CLI 응답 원문·개인 사용량 원문.
- WS·REST·로그·DB 모두 동일 규칙. 오류 메시지는 고정 문구(`usage-source.ts`)만.

## 5. 검증 계획 (합성 시계 TDD)

- 상태 전이: 성공→실패→복구→리셋 변경 시나리오를 가짜 시계로 재현.
- 연속 실패: 마지막 정상 유지 + `stale` 표시, 새 데이터 오표시 없음.
- 격리: `authentication` 1곳 + `timeout` 1곳 혼합 시 타 공급자 정상 저장.
- 결과는 해당 이슈(#39·#40)에 단위/통합·API·수집 회귀 결과로 기록.
