# OpenCode V2 실설치 검증 (2026-10-13)

- 사용자 선택 1-(b): Homebrew V1 제거 후 공식 V2 설치기 실행.
- 사용자 선택 2-(i): `feat/opencode-v2`, [PR #130](https://github.com/qus0in/yoroi/pull/130).
  [PR #128](https://github.com/qus0in/yoroi/pull/128)에 합치지 않는다.
- [공식 마이그레이션 절차](https://opencode.ai/v2/docs/migrate-v1/)를 따른다.

## 실행과 복원

1. V1 전역 설정·플러그인, 바이너리, `.zshrc`·`.zshenv`를 권한 0700 임시 디렉터리에 백업했다.
   로컬 백업 경로는 `/tmp/yoroi-opencode-backup-path`에 있다. 비밀값·원본 설정은 레포에 넣지 않는다.
2. `HOMEBREW_NO_AUTO_UPDATE=1 brew uninstall opencode`로 V1 1.18.34를 제거했다.
3. `https://opencode.ai/v2/install`을 파일로 내려받아 검토하고 `bash`로 실행했다.
4. V2 2.0.28은 `~/.opencode/bin/opencode`에 설치됐고 설치기가 `.zshrc`에 PATH를 추가했다.
5. `node scripts/opencode-hook.mjs install --target v2 --force` 실행 후 `installed target=v2`를 확인했다.
6. V1 복원이 필요하면 백업 바이너리·설정·셸 파일을 사용한다. native V2 설정을 V1에 읽히지 않는다.

## 실측 결과

- 새 zsh에서 `command -v opencode`는 V2 절대 경로, `--version`은 `opencode v2.0.28`이다.
- `debug paths`: V1과 전역 config·cache·data 경로를 공유한다.
- 기존 `opencode.jsonc`는 SHA-256 비교로 보존 확인. `cli.json`은 V2가 자동 생성했다.
- `models --standalone`: exit 0, stderr 0 bytes, 76행 중 `opencode/` 12행.
  기존 `*-free` 파서로 무료 모델 11개를 읽을 수 있다.
- SQLite `plugin_loads`의 최신 행: `loaded_version=v2`, `loaded_at=2026-10-13T10:45:04.291Z`.
  실제 V2 setup이 전역 yoroi에 보고한 값이며 수동 마커 주입은 하지 않았다.
- `plugin list`는 패키지 목록 관리 명령이다. `No plugins found`만으로 로컬 훅 실패를 판정하지 않는다.
- V2 무료 모델 경로는 stub 대신 `models --standalone`을 사용한다. V1 명령은 유지한다.
- 빌드된 yoroi 수집 경로로 재조회했을 때 무료 13개·진단 0건을 확인했다.
  첫 조회 뒤 모델 카탈로그가 갱신되므로 개수를 고정한 검증은 사용하지 않는다.
- 로컬 `.env`는 원본을 백업한 뒤 `YOROI_OPENCODE_TARGET=v2`로 설정했다. Git ignore를 확인했다.
- 훅 설치 테스트 11개, V2 수집·파서·플러그인 테스트 12개, typecheck·build·레포 검증 통과.
- 실행 중인 워커 세션은 재시작하지 않았다. 다른 V1 플러그인의 V2 호환성은 이번 검증에서 확정하지 않았다.
- 자연 발생 한도 오류·해제 이벤트와 미문서 ADAPTER 필드는 미검증이며 PR Draft를 유지한다.

## 전역 플러그인 비활성화 실패와 수정 (2026-10-14)

- `~/.config/opencode/plugins/discord-notifier.ts`는 2026-09-30에 export 줄을 주석 처리해 껐지만,
  V2는 `plugins/` 아래 모든 파일을 계속 로드한다. 주석만 남은 모듈은 export가 없어
  `PluginModule.LoadError: Plugin must export a default definition ... (cause: SchemaError(Missing key at ["default"]))`로
  서버 시작마다 WARN을 남겼다(로그 `ref=err_a96624f6`, 같은 원인 91회).
- 주석을 푸는 것만으로는 해결되지 않는다. `~/.local/share/agent-notifier/opencode.ts`는
  `export const DiscordNotifierPlugin: Plugin = async ({ client, directory }) => ...` 형태의 V1 명명 export이며
  V2가 요구하는 `export default { id, setup(ctx) }` 모양이 아니다. `yoroi-zen-free.js`·`herdr-agent-state.js`가 이 모양이다.
- 조치: 파일을 `~/.config/opencode/plugins-disabled/discord-notifier.ts`로 이동했다(내용·권한 600 유지).
  전역 로그는 `~/.local/share/opencode/log/opencode.log`이고 원인 문자열은 `cause=` 필드에 있다.
- 검증: 다음 서버 시작 뒤 `grep "discord-notifier" ~/.local/share/opencode/log/opencode.log | tail`에
  새 `ref=err_`가 없어야 한다. 실행 중 세션은 재시작하지 않았다(AGENTS.md).
- 로컬 `@opencode-ai/plugin@1.18.29`(V1 타입)와 런타임 v2.0.28의 버전 차이가 V1 모양 코드의 배경이다.

## 회고

- 목록 명령 존재 여부는 설치된 버전의 `--help`와 실제 출력으로 확인한다.
- `--version`도 홈 로그를 열기 때문에 제한된 실행 환경에서는 파일 권한 오류가 발생한다.
  홈 로그 쓰기가 허용되는 실행으로 재검증해야 설치 실패와 혼동하지 않는다.
- 전역 플러그인을 끌 때는 export를 주석 처리하지 않는다. V2는 빈 모듈도 로드하므로
  파일을 `plugins/` 밖으로 옮겨야 한다.
