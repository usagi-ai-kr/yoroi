# OpenCode Zen Free 훅

계약: [contracts-opencode-zen-free.md](contracts-opencode-zen-free.md). OpenCode 1.18.34 소스 기준이며 실제 전역 로드·자연 발생 한도 이벤트는 미확인이다.

## 설치·확인·해제

저장소 루트에서 실행한다. 먼저 실행 가능한 yoroi CLI를 준비한다.

```sh
node scripts/opencode-hook.mjs install --dry-run
node scripts/opencode-hook.mjs install
node scripts/opencode-hook.mjs status
node scripts/opencode-hook.mjs uninstall --dry-run
node scripts/opencode-hook.mjs uninstall
```

경로 우선순위는 `--config-dir <경로>` → `OPENCODE_CONFIG_DIR` → `${XDG_CONFIG_HOME:-~/.config}/opencode`다.
`install`이 출력한 실제 절대 경로를 OpenCode 프로세스의 환경과 비교한다. 설치 셸과 서버 환경이 다르면 로드되지 않을 수 있다.
`OPENCODE_CONFIG_DIR`는 OpenCode의 추가 탐색 경로다. 전역·추가 경로 양쪽에 설치하면 두 인스턴스가 로드될 수 있으므로 한 경로만 선택한다.
`--config-dir`는 `plugins`의 부모 디렉터리를 받는다. 예: `--config-dir /tmp/opencode-demo`.
`--dry-run`은 경로와 충돌 여부만 확인하며 디렉터리·파일을 생성하거나 지우지 않는다.
기존 OpenCode 프로세스는 재시작해야 새 플러그인을 로드한다. 원격 서버라면 서버 호스트에 설치한다.

진입 파일 `plugins/yoroi-zen-free.js`와 보조 모듈 `plugins/yoroi/*.js`를 함께 복사한다.
OpenCode의 디렉터리 탐색은 비재귀이므로 보조 모듈은 독립 플러그인으로 로드되지 않는다.
진입 파일은 플러그인 함수 하나만 export한다. 추가 npm 의존성은 필요 없다.
관리 표식 `// yoroi-managed: opencode-zen-free v1` 없는 대상은 덮어쓰기·삭제하지 않는다.
심볼릭 링크인 config/plugins/yoroi 디렉터리·대상 파일도 거부한다. herdr 등 다른 파일은 보존한다.
거부 메시지는 symlink 디렉터리·symlink 파일·비관리 파일·잘못된 인자·일반 파일시스템 실패를 구분한다.
설치·해제는 먼저 모든 대상을 검사한다. 쓰기 도중 OS 오류가 발생하면 부분 설치일 수 있으므로 `status` 후 재실행한다.
관리 디렉터리의 알 수 없는 파일은 삭제하지 않는다. 새 버전에서 폐기된 보조 파일의 자동 정리는 지원하지 않는다.

## 실행과 판별

`zen-free status --json`의 저장소 오류는 stdout을 비우고 stderr에 `zen-free storage error`만 출력하며 exit 1로 끝난다.

OpenCode 실행 환경에 `YOROI_BIN`을 지정하면 해당 실행 파일을 사용한다(기본 `yoroi`).
공백이 있는 실행 파일 경로도 지원하며, 값은 명령 문자열이 아닌 단일 실행 파일 경로다.
플래그나 셸 명령을 붙이지 않는다. `execFile`로 셸 없이 비동기 실행하며 6초 제한·출력 버퍼 제한을 둔다.
SQLite의 `busy_timeout` 2초에 프로세스 시작·마이그레이션 시간을 더할 여유를 둔다. 6초 초과 시 자식은 SIGKILL로 종료한다.
OpenCode는 이벤트 콜백 Promise를 기다리지 않는다. 훅 내부 직렬 큐는 보고가 끝나거나 실패한 뒤 다음 이벤트를 처리한다.
오류·출력·대화 원문은 로그로 출력하지 않는다. 실패는 삼키고 다음 관련 이벤트에서 재보고할 수 있다.

- 같은 세션의 assistant 메타데이터에서 공급자·모델을 연결한다. 모호한 세션은 무시한다.
- `opencode`의 `APIError` 중 `FreeUsageLimitError` JSON 표식 또는 `Free usage exceeded` 메시지만 무료 초과로 판별한다.
- `session.status`의 `free_tier_limit`/`opencode` 재시도 action도 지원한다. 같은 메시지에서 시각 없이 초과 보고한 뒤 오류에서 시각을 얻으면 `--retry-at`으로 한 번 보완 보고한다. 성공한 시각 포함 보고는 반복하지 않는다.
- 초과 보고 인수는 `--exceeded --model <id> --reason free_usage_exceeded`와 선택적인 `--retry-at <UTC ISO>`다.
- 헤더 이름은 대소문자를 무시한다. 유효한 `retry-after-ms` → `retry-after`(초/HTTP 날짜) → 엄격한 `retrying in 11h` 메시지 순으로 폴백한다. `status.next`는 reset으로 쓰지 않는다.
- 오류 원문·헤더·대화·토큰을 인수로 전달하지 않는다. 모델 ID는 제한된 문자와 128자 이내만 허용한다.
- 시작 때 읽기 전용 `${XDG_CACHE_HOME:-~/.cache}/opencode/models.json`에서 `opencode` 모델의 input/output 비용이 모두 0인 ID만 무료로 본다.
- 목록에 없는 `opencode` 모델의 오류 없는 `stop` 완료와 idle을 관측하면 목록을 다시 읽는다. 비어 있지 않은 목록을 읽으면 이후 재로드하지 않고, 실패·빈 목록이면 최소 5분 간격으로 다시 시도한다. 여전히 무료인지 확인되지 않으면 해제하지 않는다. 접미사만으로 무료라고 추측하지 않는다.
- 오류 없는 assistant `finish=stop` 완료를 저장하고 같은 세션 idle에서 재확인한다. 오류·중단·도구 호출·다른 모델의 idle은 해제하지 않는다.
- 초기 및 초과 뒤에는 해제 대기 상태다. 첫 정상 해제 보고 성공 뒤에는 추가 `--ok`를 호출하지 않는다. 실패하면 다음 idle에서 재시도한다.

메모리는 플러그인 인스턴스 단위이며 최근 256개 세션만 보존한다. 여러 인스턴스의 중복은 CLI/DB의 멱등 처리에 의존한다.
실제 계정 자격·현재 가격·reset 보장은 미확인이다. 재시도 시각만으로 자동 해제하지 않는다.
설치 소스는 저장소에 포함되며 현재 npm `files`는 dist만 포함하므로 이 설치 명령은 저장소 체크아웃에서 실행한다.

## 검증·회고

```sh
node --import tsx --test tests/opencode-hook-plugin.test.ts tests/opencode-hook-install.test.ts
python3 scripts/validate-repo.py
```

합성 이벤트와 임시 HOME/config/cache 디렉터리, 가짜 실행 파일을 사용한다. 실제 홈이나 전역 OpenCode 설정에는 쓰지 않는다.
회고: 보고 실행 제한은 DB 잠금 대기보다 길어야 프로세스 시작·마이그레이션 여유가 생긴다. 비동기 실행·직렬 큐·실패 격리를 함께 유지한다.
