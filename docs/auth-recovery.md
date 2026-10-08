# Claude·AGY 인증 복구 절차

- 기준일: 2026-10-08. Yoroi는 로컬 자격 증명을 수정하지 않는 읽기 전용 관측기다.
- Yoroi는 자동 refresh, 로그인, 브라우저 팝업, 모델 호출을 하지 않는다.
  인증이 만료되면 해당 공급자만 `error [authentication]`으로 격리한다.
- 복구는 공식 CLI를 사용자가 직접 실행해 수행한다.
- 이 레포에서 실행 확인은 `pnpm run dev once`로 한다. `yoroi` 명령은 설치되어 있지 않다.
- 공식 근거: [Claude CLI reference](https://code.claude.com/docs/en/cli-reference),
  [Claude costs](https://code.claude.com/docs/en/costs),
  [AGY install](https://www.antigravity.google/docs/cli/install/).

## 1. Claude

현행 우선순위: 명시 OAuth 토큰 → macOS Keychain → 동일 프로필의 `.credentials.json`.

### 1-1. 명시 토큰이 있거나 빈 값인 경우

- `YOROI_CLAUDE_OAUTH_TOKEN` 또는 `CLAUDE_CODE_OAUTH_TOKEN`이 빈 값이면 저장소로 fallback하지 않고 `authentication`이다.
- 셸에서 `unset`만 하면 `.env`에 같은 항목이 남아 있을 때 다시 로드된다.
  dev 실행은 Node의 `--env-file-if-exists=.env`로 `.env`를 읽는다.
- 따라서 값이 있는 위치를 모두 정정한다.
  - 셸 프로필과 현재 셸의 export
  - 레포의 `.env` (Git ignore 대상)
  - 서비스 매니저나 CI에 등록한 환경 변수
- 정정 후 `pnpm run dev once`로 확인한다.

### 1-2. 명시 토큰이 만료되었거나 서버가 거부한 경우 (401/403)

- 새 토큰으로 위 위치의 값을 갱신하거나, 위 위치에서 항목을 제거하고 1-3 절차를 따른다.

### 1-3. 저장소 토큰이 만료되었거나 인증에 실패한 경우

1. 실행 계정에서 공식 대화형 로그인을 실행한다 ([CLI reference](https://code.claude.com/docs/en/cli-reference)의 `claude auth login`).
   ```bash
   claude auth login
   ```
2. `CLAUDE_CONFIG_DIR`로 프로필을 지정해 쓰는 경우 같은 값을 유지한다.
   ```bash
   CLAUDE_CONFIG_DIR="/path/to/dir" claude auth login
   ```
3. 로그인 후 `pnpm run dev once`로 Claude 결과가 `ok`인지 확인한다.
   - 새 토큰이 Keychain과 파일 중 어디에 기록되는지는 이 저장소에서 실측하지 않았다.
   - 같은 프로필을 유지하면 Yoroi의 조회 순서를 바꾸지 않아도 된다.

### 1-4. Keychain 조회 실패

- 같은 프로필 디렉터리에 `.credentials.json`이 있으면 파일로 fallback한다.
- 조회가 계속 실패하면 1-3 절차로 다시 로그인한다.

### 1-5. 직접 API와 cooldown

- 인증 복구나 저장소 fallback은 API의 429 cooldown을 우회하지 못한다. 같은 계정의 한도를 공유한다.
- 현재 429는 `unavailable`이며 `Retry-After` 처리와 backoff는 구현되어 있지 않다.
- [공식 costs 문서](https://code.claude.com/docs/en/costs)의 60분 기준은 마지막 조회값의 표시 기준이며 cooldown 길이가 아니다.
- `claude auth status`의 429·cooldown 계약은 CLI reference에서 확인되지 않았다.

## 2. AGY (Google Antigravity)

- Yoroi는 `agy -p /usage`에 인증을 위임한다. 전용 resolver나 토큰 읽기는 없다.
- 1.3.1 `--help`에는 login·auth 하위 명령이 없다.
- 로그인은 대화형 `agy`에서 한다. 설치와 인증 흐름은 [AGY install 문서](https://www.antigravity.google/docs/cli/install/)를 따른다.
  1. 터미널에서 `agy`를 실행한다.
  2. 로컬이면 OS 키링의 기존 세션을 silent sign-in으로 쓰고, 세션이 없으면 브라우저 로그인으로 넘어간다.
  3. SSH 같은 원격 환경에서는 CLI가 출력하는 인증 URL을 로컬 브라우저에서 열고, 표시된 코드를 원격 프롬프트에 붙여 넣는다.
- 로그인 후 `pnpm run dev once`로 AGY 결과가 `ok`인지 확인한다.
- Gemini API key 모드(`modelProvider: gemini`, `GEMINI_API_KEY`)는 계정 세션이 없는 별도 모델 API 모드다.
  구독 quota를 복구하는 경로가 아니므로 이 절차에 포함하지 않는다.

## 3. 복구 검증

- 검증 명령은 `pnpm run dev once`다. 토큰이나 응답 원문은 출력하거나 기록하지 않는다.
- 각 공급자가 `ok` 또는 `error [코드]`로 표시되는지 확인한다.
- Claude 429는 인증 문제와 별도로 본다. 인증을 바꿔도 cooldown이 끝나기 전에는 복구되지 않을 수 있다.

## 4. 기록되지 않은 정책

- cooldown 발생 위치(API 429, 로컬 저장소, CLI 로컬 제한)는 미확정이다.
- 429 backoff와 `Retry-After` 처리 정책은 미확정이다.
- 운영자의 위험 수용 여부는 미확정이다. 이 저장소에는 수용 선언이 없다.
