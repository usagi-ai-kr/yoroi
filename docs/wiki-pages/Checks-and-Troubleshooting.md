# 체크와 문제 해결

## 로컬 검증

```bash
pnpm run typecheck
pnpm test
pnpm run test:bdd
pnpm run build
pnpm run check
```

`pnpm run check`는 타입 검사, 단위·통합 테스트, BDD, 빌드를 묶어 실행합니다. 테스트는 fake HTTP/process/scheduler와 합성 fixture를 사용하며 실제 계정 인증을 요구하지 않습니다.

## 실행 종료 코드

- `0`: 조회 성공 또는 부분 성공, 최상위 도움말(`yoroi --help`·`yoroi -h`) 및 버전(`--version`·`-v`) 출력
- `1`: 선택된 공급자가 모두 실패
- `2`: 알 수 없는 명령·플래그(예: `once --bogus`), 제거된 `watch` 실행, 잘못된 인자·설정 오류, 존재하는 `.env`(현재 디렉터리 또는 설치 위치) 로드 실패

최상위와 `once` 서브커맨드 도움말은 stdout에 사용법을 출력하고 exit 0으로 끝납니다. 예: `yoroi --help`, `yoroi once --help`. `watch`를 실행하면 제거 안내와 `yoroi once` 대안을 stderr에 출력하고 exit 2를 반환합니다. 주기 실행은 외부 스케줄러에 `yoroi once`를 등록하세요.

공급자 인증/설치 실패는 해당 공급자 결과로 격리됩니다. `YOROI_PROVIDERS`의 이름·중복 여부와 실행 환경의 변수 우선순위를 확인하세요.

## 인증 오류

- Codex·OpenCode Go·Ollama·AGY·Claude는 서로 다른 인증 경로를 사용합니다. [공급자와 인증](Providers-and-Authentication)에서 필요한 변수명과 프로필을 확인합니다.
- Claude의 명시 토큰 변수가 셸, 서비스 환경, `.env` 중 어디에 남았는지 확인하세요. 빈 명시값은 저장 프로필로 fallback하지 않습니다.
- Claude 재로그인은 사용자가 직접 같은 프로필에서 `claude auth login`을 실행합니다. AGY는 대화형 `agy`를 사용합니다. Yoroi는 로그인이나 refresh를 자동 실행하지 않습니다.
- 오류 공유에는 `authentication`, `unavailable`, `timeout` 같은 정규화 코드만 사용하고 토큰·응답 본문은 제외합니다.

## CI와 HTTP 문제

- CI job `ci`와 changed-file classifier는 항상 실행됩니다. `docs_only`이면 classifier 뒤 fast-pass로 완료하고 repo validation, dependency install, app check는 건너뜁니다.
- `docs/**`, 루트 `README.md`, `AGENTS.md`, `CLAUDE.md`만 변경된 경우가 docs-only입니다. `.agents/skills/**`, scripts 또는 app 코드가 함께 바뀌면 full 경로가 실행됩니다.
- manual/초기 push, SHA 누락, 빈 diff, git 분류 오류는 보수적으로 full 경로입니다. `validate-repo.py --ci`는 문서 내용 줄 검사를 생략하지만 skill 검증은 유지합니다.
- full CI 경로는 다음 검증을 실행합니다.
  ```bash
  python3 scripts/validate-repo.py --ci
  python3 -m unittest discover -s scripts -p "test_*.py"
  python3 .agents/skills/agent-coordination/scripts/test_coordination.py
  pnpm install --frozen-lockfile
  pnpm run check
  ```
- unittest 자동 검색은 버전 테스트 9개와 CI scope 테스트 10개(총 19개)를 실행합니다. coordination 회귀 테스트는 별도로 실행합니다.
- main의 필수 체크는 `ci`이며 최신 PR head의 적격 `pull_request` run을 확인합니다. `workflow_dispatch` 성공만으로 PR 필수 체크가 충족되지는 않습니다.
- Claude HTTP 429는 현재 `unavailable`로 격리됩니다. Yoroi는 `Retry-After`를 처리하거나 backoff하지 않습니다.
- 공식 Claude Code `/usage`의 마지막 값 표시·재시도 기능은 CLI 동작입니다. Yoroi의 내부 usage GET이 같은 캐시나 cooldown을 제공한다는 뜻은 아닙니다.
- HTTP 응답 본문은 최대 1MiB까지 읽으며 초과 응답은 안전한 `unavailable` 오류로 정규화합니다.

## 버전 dry-run과 발행 기준

```bash
python3 scripts/version.py --bump patch
python3 scripts/version.py --bump patch --apply
```

첫 명령은 dry-run이고 파일을 쓰지 않습니다. `--apply`를 명시한 두 번째 명령만 `package.json` 버전을 갱신합니다. commit/tag/Release는 자동 생성하지 않습니다. 발행 기준 SHA는 전체 검증과 `pull_request` CI가 성공한 PR 병합 commit이어야 하며, tag가 같은 SHA를 가리키는지 확인합니다. 자세한 정책은 [버전 관리](https://github.com/qus0in/yoroi/blob/main/docs/versioning.md)를 참고합니다.

## 추가 자료

- [GitHub 운영과 필수 체크](https://github.com/qus0in/yoroi/blob/main/docs/github.md)
- [개발·검증 명령](https://github.com/qus0in/yoroi/blob/main/docs/development.md)
- [Claude 운영 한계](https://github.com/qus0in/yoroi/blob/main/docs/claude-operations.md)
