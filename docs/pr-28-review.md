# PR #28 리뷰 조치 (2026-10-08)

- 사용자 요청: 기본 공급자 5개, 나머지 리뷰 조치와 분담 진행.
- 대상: [검토 의견](https://github.com/qus0in/yoroi/pull/28#issuecomment-6049864366).
- worker1/AGY: 기본 공급자·CLI 안내·완료 기준 watch 주기·설정/BDD 검증.
- worker2/OpenCode: HTTP 본문 제한·스트림 정리·Ollama 장애 격리 회귀 검증.
- 추가 worker/OpenCode: CI 이벤트·보호 설정의 독립 검토, #1–25 완료 기준 대조.
- orchestrator/Codex: PR 차단/CI 이벤트 확인·workflow·문서·통합·PR 게시.

## 정책과 완료 기준

1. 공급자 미지정은 기본 5개, 명시는 선택한 공급자만 조회한다.
   인증/설치가 없는 공급자는 개별 실패로 격리하며 전체 조회를 중단하지 않는다.
2. watch는 첫 수집 즉시 실행, 완료 후 기본 60초 대기한다.
   실제 시작 간격은 수집 시간+60초다. fake 시간으로 지연·비중첩·취소를 검증한다.
3. HTTP는 본문 1MiB 최대 바이트 제한을 적용한다. 초과 시 스트림 취소와 안전한 오류를 검증한다.
4. Ollama 비공식 인증/포맷 변경에서 다른 4개 공급자 결과 유지 BDD를 릴리스 검사에 포함한다.
5. PR 필수 ci는 적격 PR 이벤트 실행 결과로 확인하며 보호 규칙을 유지한다.

## PR 차단 원인

- HEAD의 ci는 성공하고 check-run의 앱·SHA·PR 연결도 일치했다.
  그러나 실행 이벤트는 workflow_dispatch, PR 체크 rollup은 비어 있었고 mergeable_state는 blocked였다.
- GitHub 문서는 수동 workflow job 체크가 PR 필수 체크로 평가되지 않는다고 명시한다.
  [필수 체크 문제 해결](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).
- main 보호의 다른 조건과 중복 commit status·추가 ruleset은 차단 원인이 아니었다.
- workflow에 opened/synchronize/reopened/ready_for_review 활동을 명시하고
  실행 이름에 이벤트를 표시했다. 오래된 동일 PR 실행은 concurrency로 취소한다.
- 자동 실행이 누락되면 승인 대기 및 PR 이벤트 재발생을 확인한다.
  필수 체크 삭제·완화 또는 수동 성공 상태 등록으로 해결하지 않는다.
- 동일 PR을 close → reopen하여 최초 적격 pull_request 실행을 확인했다.
  [재오픈 CI](https://github.com/qus0in/yoroi/actions/runs/37710991343)는 이전 HEAD 검증이며,
  리뷰 수정 게시 후 최신 HEAD의 synchronize 실행을 별도로 확인한다.

## 회고

- workflow 성공과 PR 머지 조건 충족을 구분한다. event·최신 SHA·PR 체크 결과까지 검증한다.
- 기본 다중 공급자 실행에서는 인증 누락을 전체 설정 오류로 처리하지 않는다.
- 아직 발행 전인 0.1.0 MVP의 리뷰 조치이며 버전·milestone 범위는 유지한다.
- PR 머지 후 #1–25 완료 기준과 검증 근거를 대조한다. 후속 신규 범위는 작업별 PR로 나눈다.

## 통합 검증

- `pnpm run check`: 타입 검사·단위/통합 89개·BDD 22시나리오/119단계·빌드 통과.
- `python3 scripts/validate-repo.py`: 114파일·3스킬 통과.
- 기본 5개 실제 조회에서 root는 Claude 비용 요약을 받아 parse 오류, 다른 4개는 성공했다.
  worker는 같은 경로·버전에서 한도 형식을 받아 5개 모두 성공했다. 환경 차이 원인은 미확정이다.
  비용을 한도로 추정하지 않고 reset 접미사·부가 섹션의 합성 회귀 테스트를 추가했다.
  확인 조건은 [handle #29](https://github.com/qus0in/yoroi/issues/29)에 기록했으며 다른 조회는 유지한다.
- 개인 사용량 조회는 메모리 캡처 후 공급자 상태만 출력한다. 원문 리다이렉트를 사용하지 않는다.

## 이슈 완료 기준 대조

- #1–25는 읽기 전용으로 대조했으며 PR 게시·머지 상태에 맞춰 종료 여부를 판단한다.
- #13·#18 비공식 Ollama API 사용은 사용자가 직접 허가했다. 공식 API로 표기하지 않는다.
- #15–17 한도 소진 fixture·CLI 지원 버전 정책, #3 red→green 근거는 추가 확인 대상이다.
- #17·#22 reset 미매핑은 후속 사용자 지시에 따라 날짜·IANA 시간대를 해석해 UTC로 변환하도록 조치했다.
- 이 리뷰 조치만으로 이슈를 일괄 종료하거나 milestone·tag·Release를 발행하지 않는다.

## Claude reset 후속 조치

- 사용자 확인: 한도 출력에 날짜·시각·시간대가 제공되므로 resetAt에 반영한다.
- 표기된 IANA 시간대로 UTC를 계산하며 실행 머신의 시간대나 문자열 Date.parse에 의존하지 않는다.
  [ECMA-402 시간대/formatToParts](https://tc39.es/ecma402/#sec-intl-datetimeformat-prototype-formattoparts)를 사용한다.
- 생략 연도는 관측 시각의 해당 지역 연도와 인접 연도 중 가장 가까운 날짜로 해석한다.
  연말 경계와 리셋 직후의 과거 시각을 다루며 명시 연도는 그대로 사용한다.
- 무효 날짜·시간대·지원하지 않는 형식·DST 중복/없는 시각은 reset만 unknown으로 남긴다.
  정상 percent는 보존하며 비용 요약 응답 문제 #29와는 별도로 검증한다.
- 테스트 105개·BDD 22시나리오/120단계·타입 검사·빌드 통과, 레포 검사 116파일/3스킬 통과.
  실제 Claude 어댑터의 합성 출력부터 CLI reset 표시까지 BDD로 확인했다.

## 자동 조회 재검토

- 후속 댓글에서 print 경로의 모델 실행 보장 부족을 지적했다. Claude 자동 수집을 usage GET으로 교체했다.
- 기본 5개 선택은 유지하며 CLI·모델 API·credential 갱신으로 fallback하지 않는다.
- 인증 환경 대조·조회 근거·검증·회고는 [claude-readonly.md](claude-readonly.md)에 기록한다.

## 최종 검증 (freeze, 2026-10-08)

- 단위·통합 128개, BDD 25 시나리오/144 step, 레포 검사 129파일·3스킬 PASS.
- 위 105개·22 시나리오·114/116파일 수치는 당시 라운드 기록이며 최종 수치가 아니다.
- 최종 Claude 변경은 OAuth 사용량 GET 교체, 엄격한 reset 파싱, 인증 격리 회귀 테스트를 포함한다.
- 상세 검증·한계는 [claude-readonly.md](claude-readonly.md), PR 답글 근거는 게시된 PR 댓글을 따른다.

## 최종 재검토 반영 (2026-10-08)

- 재검토 댓글 6050713889의 위험 항목(내부 API, 로그인 만료, #29)을 [claude-operations.md](claude-operations.md)에 정리했다.
- 위험 수용과 정책 승인은 기록되어 있지 않다. #29는 비차단 별도 조사로 둔다.
- PR #28 병합 완료: merge commit `48bdd8e`, dev 동기화 완료. 이후 작업은 [tasks.md](tasks.md)에 기록한다.
