# 공급자와 인증

| 공급자 | 조회 경로 | 인증 요약 |
| --- | --- | --- |
| Codex | `codex app-server`의 읽기 전용 rate-limit 메서드 | 실행 계정의 Codex CLI 로그인 |
| Ollama Pro | 비공식 서명 usage/balance 조회 | 기본 `$HOME/.ollama/id_ed25519` 또는 `YOROI_OLLAMA_PRO_SIGNING_KEY_PATH` |
| OpenCode Go | 공식 Go usage API | `YOROI_OPENCODE_GO_API_KEY` |
| AGY | `agy -p /usage` | AGY CLI가 관리하는 세션 인증 |
| Claude | OAuth usage GET | 명시 OAuth 변수 또는 실행 계정의 기존 프로필 |

## 환경 변수와 프로필

- `YOROI_PROVIDERS`: 선택할 공급자 ID 목록. 생략하면 다섯 개 모두 조회합니다.
- `YOROI_TIMEOUT_MS`: 전체 기본 timeout(기본 10000ms). `YOROI_<공급자>_TIMEOUT_MS`로 개별 조정합니다.
- `YOROI_INTERVAL_SECONDS`: `watch` 간격 초(기본 60). `YOROI_DEBUG=1`이면 읽은 `.env` 경로만 표시합니다.
- `YOROI_CODEX_PATH`, `YOROI_AGY_PATH`: 실행 파일 경로를 지정할 때 사용합니다.
- `YOROI_OPENCODE_GO_API_KEY`: OpenCode Go API key를 실행 환경에 제공합니다.
- `YOROI_OLLAMA_PRO_SIGNING_KEY_PATH`: Ollama Pro Ed25519 서명 키 경로를 바꿉니다.
- 실행 시 이미 설정된 환경 변수가 두 `.env` 값보다 우선하며, 남은 키는 cwd `.env`가 설치 사본보다 우선합니다(키 단위 병합, 통째 대체 아님). 변수명만 문서화하며 실제 값을 Wiki에 올리지 마세요.

## Claude OAuth

인증 선택 순서는 `YOROI_CLAUDE_OAUTH_TOKEN` → `CLAUDE_CODE_OAUTH_TOKEN` → 저장된 기존 프로필입니다. 명시 변수가 빈 값이면 저장소로 fallback하지 않습니다. `CLAUDE_CONFIG_DIR`(없으면 실행 계정 HOME의 `.claude`)과 `CLAUDE_SECURESTORAGE_CONFIG_DIR`이 있으면 그 프로필을 사용합니다.

- Yoroi는 로그인·refresh·credential 저장을 실행하지 않습니다.
- macOS에서는 Keychain을 읽고, 조회가 실패하면 동일 프로필의 `.credentials.json`을 확인합니다.
- 만료된 세션은 사용자가 같은 프로필에서 `claude auth login`으로 갱신한 뒤 `yoroi once`로 확인합니다.
- Claude의 `/api/oauth/usage` 경로는 CLI 내부 경로이며 공개 API 지원·호환성을 보장하지 않습니다.
- 상세 복구 절차: [Claude·AGY 인증 복구](https://github.com/qus0in/yoroi/blob/main/docs/auth-recovery.md).

## AGY 인증

AGY 인증은 `agy -p /usage` 호출을 통해 CLI에 위임합니다. 1.3.1 도움말에 전용 login/auth 하위 명령은 없습니다. 세션이 없으면 대화형 `agy`를 실행해 로그인하고, 이어서 `yoroi once`로 확인합니다. Gemini API key 모드는 구독 사용량 세션과 별개입니다.

## Reset 시각

Claude API 응답의 유효한 `resets_at`은 명시 시간대를 사용해 UTC ISO 8601 `resetAt`으로 정규화합니다. 값이 없으면 reset만 생략하고, 잘못된 API reset 값은 parse 오류로 처리합니다. 상세 정책은 [Claude 계약](https://github.com/qus0in/yoroi/blob/main/docs/contracts-claude.md)을 참고합니다.
