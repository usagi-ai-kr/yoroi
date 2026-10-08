# Codex 조회 계약 (#15)

- 확인일: 2026-10-07. 설치 CLI: `codex-cli 0.160.1` (`codex --version`).
- 실행 파일: PATH의 `codex`, 또는 런타임 설정의 명시 경로.
- 공식 근거: [App Server](https://learn.chatgpt.com/docs/app-server),
  [CLI commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli).
- `/status`는 대화형 확인용이다. 자동 수집에는 app-server의 문서화된 읽기 메서드를 사용한다.

## 선택한 호출

1. `codex app-server --stdio`를 shell 없이 executable/args 배열로 실행한다.
2. stdout JSONL에서 응답 ID를 구분한다. `initialize` 요청(id=1)을 보내 응답을 기다린다.
3. `initialized` 알림 후 `account/rateLimits/read` 요청(id=2)을 보낸다.
4. id=2 응답을 받으면 stdin을 닫고 자식 종료를 기다린다. timeout이면 자식을 종료한다.
- `thread/start`·`turn/start`·`exec`를 사용하지 않으므로 모델 프롬프트를 생성하지 않는다.
- PTY·ANSI·locale 의존 파싱은 필요 없다. stdout JSON만 파싱하고 stderr는 출력하지 않는다.
- 기존 CLI 인증을 사용한다. credential 파일을 읽거나 새 로그인하지 않는다.

## 매핑과 실패

- `rateLimitsByLimitId`가 있으면 모든 bucket을 사용하고, 없으면 `rateLimits`를 사용한다.
- primary/secondary → 각 UsageWindow. usedPercent → percent, 단위 percent.
- windowDurationMins는 창 ID에 보존한다. resetsAt(Unix 초)은 ISO resetAt으로 변환한다.
- null 창/미제공 reset은 추정하지 않는다. used/remaining/limit 절대량도 생성하지 않는다.
- JSON-RPC 오류는 민감 원문을 숨기고 정규화한다. 미설치·timeout·non-zero·형식 변경 구분.
- 테스트 fixture는 공개 문서 구조의 합성 데이터다. 개인 계정의 원본은 저장하지 않는다.
- 실제 계정 읽기 조회 smoke 성공: 사용량 창 2개 파싱. 개인 수치·원문은 기록하지 않았다.
