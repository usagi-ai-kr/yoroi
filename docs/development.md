# 개발과 검증

Yoroi는 AI 사용량 모니터링 CLI다. Node 24.13.1·pnpm 12.10.1을 고정한다. TypeScript strict/NodeNext ESM을 사용하며 단위·통합은 node:test, BDD는 Cucumber다.
버전 원본은 `package.json`의 `0.5.0`이며 [0.5.0 milestone](https://github.com/qus0in/yoroi/milestone/7)(#70)과 연결한다. tag·Release 발행 기록은 [release-status.md](release-status.md)를 따른다.

## 앱 실행과 검증

```bash
pnpm install --frozen-lockfile
pnpm run dev --help
pnpm run dev once
pnpm --silent run dev once --pretty
pnpm run typecheck
pnpm test
pnpm run test:bdd
pnpm run build
node --env-file-if-exists=.env dist/src/main.js --help
node dist/src/main.js --version
pnpm run install:global
yoroi --version
pnpm remove -g yoroi
pnpm run check
```

- `once`: 단발 조회. 성공/부분 성공은 0, 전체 공급자 실패는 1, 인자·설정 오류는 2.
- `detect`: 내장 10분 감지 루프(포그라운드, 알림은 stdout 한 줄). `--once`·`--json`·`status`가 있고 정상 종료·신호 0, 인자 오류 2다. 운영은 [detect.md](detect.md).
- `watch`는 0.3.0에서 제거됐다. 주기 실행이 필요하면 외부 스케줄러로 `yoroi once`를 실행한다(마이그레이션).
- 도움말은 최상위 `yoroi --help`·`yoroi -h`와 서브명령 `yoroi once --help`·`-h` 모두 exit 0으로 사용법을 출력한다. 잘못된 인자는 exit 2다(실측).
- `pnpm --silent`: pnpm 실행 배너를 억제해 pretty 표나 CLI 스냅샷 터미널 출력을 온전히 확인하기 위해 사용한다(배너가 무해한 일반 실행에는 생략).
- SIGINT/SIGTERM에서 수집을 취소하고 자식 프로세스·timer·signal 구독을 정리한다.
- `check`는 타입 검사·단위/통합·BDD·빌드다. 아래 레포 검증도 별도로 실행한다.
- 시간 제한 실패의 재현 조건·판정·대응은 [불안정 테스트 기록](flaky-tests.md)을 따른다.
- 개별 테스트는 `node --import tsx --test tests/<파일>.test.ts`로 실행하며 node:test 컨텍스트가 데이터 경로를 임시 디렉터리로 격리한다.
- 출력 테스트는 ANSI 제거 후 비교한다. CI를 위해 `FORCE_COLOR=1` 통과도 확인한다.
- 테스트는 fake source/HTTP/process/scheduler와 fixture를 써서 실제 계정·네트워크·설치된 공급자 CLI 없이 통과해야 한다.
- dev는 Node의 `--env-file-if-exists=.env`로 로컬 설정을 읽고 `--import tsx`로 실행한다. 이미 지정된 환경 변수가 .env보다 우선하며 .env는 Git ignore 대상이다.
- 전역 설치·.env: [global-install.md](global-install.md) / 갱신 절차: `global-cli-update` 스킬 참조
- pnpm은 packageManager 버전을 고정하며 Corepack 시 `corepack enable pnpm`을 쓴다. [pnpm 설치](https://pnpm.io/installation)·[CI setup](https://github.com/pnpm/setup)을 따르고 필요 시 Node/Corepack 경로를 우선한다.
- CI는 설명문서만 변경 시 빠른 통과, 그 외에는 `validate-repo.py --ci`·스킬 검증·frozen install·check를 실행한다. PR 필수 체크는 `pull_request` 실행으로 확인하며 수동 `workflow_dispatch`는 진단용이다(단 main 머지 커밋 검증에는 versioning.md 절차에 따라 `workflow_dispatch` 활용).

## 설정과 공급자 상태

- 설정은 `src/config/load-config.ts`에서 환경 변수로 읽고 composition root에서 해석한다.
- `YOROI_PROVIDERS`: 기본 여섯 공급자 모두 조회(`ollama-pro,opencode-go,codex,agy,claude,xai`).
  쉼표로 명시하면 해당 공급자만 조회한다. 중복·미지원 ID는 설정 오류다.
- `YOROI_DATA_DIR`: 로컬 SQLite 저장 디렉터리. 기본 `${XDG_DATA_HOME:-~/.local/share}/yoroi`이며 DB 파일은 `yoroi.db`다(디렉터리 0700·파일 0600, #72).
- 공급자 인증/설치 누락은 공급자별 오류로 격리하고 다른 조회를 계속한다.
  전체 실패는 exit 1, 선택·timeout 등 잘못된 설정은 exit 2다.
- `YOROI_TIMEOUT_MS`: 기본 10000. `YOROI_<공급자>_TIMEOUT_MS`로 개별 override.
- `YOROI_CODEX_PATH`, `YOROI_AGY_PATH`: 실행 파일 경로, 기본 PATH 탐색.
- `YOROI_OPENCODE_TARGET`: `v1`|`v2`, 기본 `v1`. V2는 `models --standalone`으로 무료 모델을 읽는다([실측](opencode-v2-migration.md)). 그 밖의 값은 설정 오류로 exit 2다.
- Claude는 CLI를 실행하지 않고 OAuth 사용량 GET만 호출한다. 인증 우선순위는
  `YOROI_CLAUDE_OAUTH_TOKEN` → `CLAUDE_CODE_OAUTH_TOKEN` → 기존 저장소다.
  `CLAUDE_CONFIG_DIR` 또는 실행 계정 HOME의 설정을 읽는다. 로그인·갱신·저장은 수행하지 않는다.
  macOS Keychain은 `security find-generic-password` 읽기 호출만 사용하며 실패하면 같은 프로필의 파일을 본다.
  API key/Bedrock/Vertex를 구독 OAuth로 대체하지 않는다. 상세 근거는 [읽기 전용 검증](claude-readonly.md).
- OpenCode Go는 `YOROI_OPENCODE_GO_API_KEY`가 필요하다.
- Ollama는 기본 `$HOME/.ollama/id_ed25519`를 사용한다.
  `YOROI_OLLAMA_PRO_SIGNING_KEY_PATH`로 서명 키 경로를 변경한다. Bearer 토큰과 다르다.
- xAI(SuperGrok)는 자격·네트워크 없이 로컬 `opencode stats --json --models --cost --days 7`의 `xai` 행만 합산한다.
  실행 파일은 기본 `opencode`(`YOROI_XAI_PATH`, `YOROI_XAI_TIMEOUT_MS`). 소비량(`used`)만 보고하며 한도·잔여는 없고,
  `xai` 행이 없으면 사용 0이다. 토큰 갱신·`auth.json` 접근은 하지 않는다.
- credential은 로그·오류·fixture에 출력하지 않는다. 개인 사용량 원본은 저장하지 않는다.
- HTTP 응답은 1MiB까지 읽으며 초과 시 본문 스트림을 취소하고 unavailable로 정규화한다.

| 공급자 | 수집 방식 | 실제 구현 상태 | 계약 |
| --- | --- | --- | --- |
| Codex | CLI app-server JSONL | 구현·fake 테스트·실제 조회 성공 | [계약](contracts-codex.md) |
| Ollama Pro | 비공식 서명 usage/balance API | 실제 조회 성공·7개 창 파싱 | [계약](contracts-ollama.md) |
| OpenCode Go | 공식 Go usage API | 실제 조회 성공·3개 창 파싱 | [계약](contracts-opencode.md) |
| AGY | `agy -p /usage` | 구현·실제 CLI 구조 확인 | [계약](contracts-agy.md) |
| Claude | OAuth usage GET (내부 경로) | CLI 실행 제거·읽기 전용 경계 검증 | [계약](contracts-claude.md) |
| xAI | `opencode stats --json` 로컬 집계 | fake 테스트·실제 출력 형식 확인(소비량만) | [파서](../src/infra/xai-opencode-stats-parser.ts) |

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
- `--ci`는 설명문서 내용 검사(줄 수)만 제외하고 스킬 검증은 유지한다.
  로컬 기본 실행은 문서 줄 수까지 포함한 전체 검증을 유지한다.
- 레포 검증 자체는 외부 패키지 설치나 네트워크 접속 없이 실행할 수 있다.

## 파일 크기 예외

- 줄 수 검사 제외: 잠금 파일(`package-lock.json`·`pnpm-lock.yaml`·`yarn.lock`·`uv.lock`·`poetry.lock`·`Cargo.lock`·`Gemfile.lock`·`go.sum`), Gradle wrapper(`gradlew`·`gradlew.bat`), 바이너리.
- 예외 추가 시 이 문서와 검증 스크립트를 함께 갱신한다.
