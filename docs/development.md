# 개발과 검증

Yoroi는 AI 사용량 모니터링 CLI다. Node 24.13.1·pnpm 12.10.1을 고정한다.
TypeScript strict/NodeNext ESM을 사용하며 단위·통합은 node:test, BDD는 Cucumber다.
버전 원본은 `package.json`의 `0.1.0`이며 [milestone](https://github.com/qus0in/yoroi/milestone/1)과 연결한다. 릴리스 발행은 없다.

## 앱 실행과 검증

```bash
pnpm install --frozen-lockfile
pnpm run dev --help
pnpm run dev once
pnpm run dev watch
pnpm run dev watch --interval 30
pnpm run typecheck
pnpm test
pnpm run test:bdd
pnpm run build
node --env-file-if-exists=.env dist/src/main.js --help
node dist/src/main.js --version
pnpm run check
```

- `once`: 단발 조회. 성공/부분 성공은 0, 전체 공급자 실패는 1, 인자·설정 오류는 2.
- `watch`: 즉시 1회 후 **수집 완료 뒤 60초 대기**한다. 시작 간격은 수집 시간+60초다.
  분 단위 고정 시작이 아닌 완료 기준 대기이며 조회가 겹치지 않는다.
- SIGINT/SIGTERM에서 수집을 취소하고 자식 프로세스·timer·signal 구독을 정리한다.
- `check`는 타입 검사·단위/통합·BDD·빌드다. 아래 레포 검증도 별도로 실행한다.
- 테스트는 fake source/HTTP/process/scheduler 및 합성 fixture를 사용한다.
  실제 계정·네트워크·설치된 공급자 CLI 없이 통과해야 한다.
- dev는 Node의 `--env-file-if-exists=.env`로 로컬 설정을 읽고 `--import tsx`로 실행한다.
  이미 지정된 환경 변수가 .env보다 우선한다. .env는 Git ignore 대상이다.
- pnpm 버전은 packageManager에 고정한다. Corepack 사용 시 `corepack enable pnpm`으로 활성화한다.
- [pnpm 설치](https://pnpm.io/installation)·[CI setup](https://github.com/pnpm/setup)의 현행 지침을 적용한다.
  다른 pnpm이 PATH에서 앞서면 `pnpm --version`으로 확인하고 Node/Corepack 경로를 우선한다.
- CI는 frozen install·레포 검사·전체 check를 실행한다. PR 필수 체크는 `pull_request` 실행으로 확인한다.
  수동 `workflow_dispatch` 성공은 진단용이며 PR 필수 체크 충족으로 간주하지 않는다.

## 설정과 공급자 상태

- 설정은 `src/config/load-config.ts`에서 환경 변수로 읽고 composition root에서 해석한다.
- `YOROI_PROVIDERS`: 기본 다섯 공급자 모두 조회(`ollama-pro,opencode-go,codex,agy,claude`).
  쉼표로 명시하면 해당 공급자만 조회한다. 중복·미지원 ID는 설정 오류다.
- 공급자 인증/설치 누락은 공급자별 오류로 격리하고 다른 조회를 계속한다.
  전체 실패는 exit 1, 선택·timeout 등 잘못된 설정은 exit 2다.
- `YOROI_INTERVAL_SECONDS`: 기본 60, 정수 1–86400초.
  `watch --interval`은 초 단위 override이며 최대 86400초, 최소 1ms 단위 양수다.
- `YOROI_TIMEOUT_MS`: 기본 10000. `YOROI_<공급자>_TIMEOUT_MS`로 개별 override.
- `YOROI_CODEX_PATH`, `YOROI_AGY_PATH`: 실행 파일 경로, 기본 PATH 탐색.
- Claude는 CLI를 실행하지 않고 OAuth 사용량 GET만 호출한다. 인증 우선순위는
  `YOROI_CLAUDE_OAUTH_TOKEN` → `CLAUDE_CODE_OAUTH_TOKEN` → 기존 저장소다.
  `CLAUDE_CONFIG_DIR` 또는 실행 계정 HOME의 설정을 읽는다. 로그인·갱신·저장은 수행하지 않는다.
  macOS Keychain은 `security find-generic-password` 읽기 호출만 사용하며 실패하면 같은 프로필의 파일을 본다.
  API key/Bedrock/Vertex를 구독 OAuth로 대체하지 않는다. 상세 근거는 [읽기 전용 검증](claude-readonly.md).
- OpenCode Go는 `YOROI_OPENCODE_GO_API_KEY`가 필요하다.
- Ollama는 기본 `$HOME/.ollama/id_ed25519`를 사용한다.
  `YOROI_OLLAMA_PRO_SIGNING_KEY_PATH`로 서명 키 경로를 변경한다. Bearer 토큰과 다르다.
- credential은 로그·오류·fixture에 출력하지 않는다. 개인 사용량 원본은 저장하지 않는다.
- HTTP 응답은 1MiB까지 읽으며 초과 시 본문 스트림을 취소하고 unavailable로 정규화한다.

| 공급자 | 수집 방식 | 실제 구현 상태 | 계약 |
| --- | --- | --- | --- |
| Codex | CLI app-server JSONL | 구현·fake 테스트·실제 조회 성공 | [계약](contracts-codex.md) |
| Ollama Pro | 비공식 서명 usage/balance API | 실제 조회 성공·7개 창 파싱 | [계약](contracts-ollama.md) |
| OpenCode Go | 공식 Go usage API | 실제 조회 성공·3개 창 파싱 | [계약](contracts-opencode.md) |
| AGY | `agy -p /usage` | 구현·실제 CLI 구조 확인 | [계약](contracts-agy.md) |
| Claude | OAuth usage GET (내부 경로) | CLI 실행 제거·읽기 전용 경계 검증 | [계약](contracts-claude.md) |

- 계층·의존 규칙은 [architecture.md](architecture.md), 이슈별 결과는 [issue-status.md](issue-status.md).
- 웹 UI·DB/히스토리 저장·알림은 이번 CLI 범위 밖이다.
- CLI/API 호출은 실행 호스트에서 수행한다. 서버에서도 같은 수집 포트를 사용하며
  CLI 설치·로그인·키 파일 권한은 서버 실행 계정에 맞춘다.

## 기본 검증

필요 도구: Git, Python 3, Bash, macOS/Linux 기본 유틸리티.

```bash
python3 scripts/validate-repo.py
bash .agents/skills/skill-authoring/scripts/validate.sh .agents/skills/github-workflow 100
```

- 추적 파일과 ignore되지 않은 신규 파일을 검사한다. staging은 필요 없다.
- Git 초기화 전에는 임시 Git 디렉터리로 파일 목록만 조회하며 저장소를 변경하지 않는다.
- 스킬 필수 필드·이름·상대 링크, 전체 파일 줄 수·심볼릭 링크를 검증한다.
- CI는 문서·스킬 변경에도 같은 레포 검증을 실행한다.
- 레포 검증 자체는 외부 패키지 설치나 네트워크 접속 없이 실행할 수 있다.

## 파일 크기 예외

- 잠금 파일: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `uv.lock`,
  `poetry.lock`, `Cargo.lock`, `Gemfile.lock`, `go.sum`.
- 생성된 Gradle wrapper: `gradlew`, `gradlew.bat`.
- 바이너리는 줄 수 검사에서 제외한다.
- 예외 추가 시 이 문서와 검증 스크립트를 함께 갱신한다.
