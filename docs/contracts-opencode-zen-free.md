# OpenCode Zen Free 플러그인 계약

확인일: 2026-10-10. [#73](https://github.com/qus0in/yoroi/issues/73)·[상위 #72](https://github.com/qus0in/yoroi/issues/72)를 `gh issue view`로 읽고 조사했다.
모델 요청·한도 유발 시험·사용량 조회·전역 설정 수정 없이 정적 근거만 확인했다. 실제 이벤트 수신은 **미확인**이다.

## 버전과 근거

- 로컬 `/opt/homebrew/bin/opencode --version`: **1.18.34**; Homebrew 설치의 arm64 Mach-O 실행 파일이다.
- `~/.config/opencode/node_modules/@opencode-ai/{plugin,sdk}/package.json`: 모두 **1.18.29**다. CLI와 타입 버전 차이를 전제로 한다.
- 로컬 `plugin/dist/index.d.ts`의 `PluginInput`·`Hooks.event`, `plugin/dist/shell.d.ts`, `sdk/dist/gen/types.gen.d.ts` 및 `sdk/dist/v2/gen/types.gen.d.ts`를 읽었다.
- 아래 소스 링크는 공식 저장소 **v1.18.34 태그**다. 로컬 바이너리와 소스의 빌드 동일성·Bun 세부 버전은 **미확인**이다.
- `~/.config/opencode/plugins/herdr-agent-state.js`는 읽기 전용 예시로 확인했다. named 함수와 default `{ id, server, setup }`, 세션별 이벤트 처리 사례이며 Zen 한도 계약의 근거는 아니다.

## 오류 이벤트와 공급자·모델 연결

플러그인 진입은 `event: async ({ event }) => { ... }`이고, `event.type === "session.error"`를 검사한다.

| 의미 | 실제 경로 / 제약 |
| --- | --- |
| 세션 | `event.properties.sessionID?: string` |
| 오류 | `event.properties.error?` |
| 오류 이름 | `event.properties.error.name` (`APIError` 등) |
| 메시지 | `event.properties.error.data.message` |
| HTTP 상태 | `event.properties.error.data.statusCode?` (`APIError`일 때) |
| 재시도·응답 | `error.data.isRetryable`, `responseHeaders?`, `responseBody?` (`APIError`) |
| 공급자·모델 | `session.error`에는 **없음**. `message.updated`의 `event.properties.info.providerID`·`modelID` (`role === "assistant"`) |

`message.updated`에서 assistant의 `sessionID`·`id`·`providerID`·`modelID`를 메모리에 연결한다.
동일 세션의 현재 assistant를 특정할 수 없거나 세션 ID가 없으면 공급자를 추측하지 않고 무시한다.
전역 설정의 기본 모델이나 다른 세션의 마지막 모델을 대용하지 않는다. 혼합 모델·동시 세션의 실제 순서는 **미확인**이다.
소스상 assistant 생성·갱신이 processor 실행보다 앞서며, 최종 오류 발행은 완료 메시지 갱신보다 앞설 수 있다.
근거: [prompt.ts](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/prompt.ts#L1186), [processor.ts](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/processor.ts#L609), [오류 변환](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/message-v2.ts#L610).

## 무료 초과 판별과 재시도

- 권장 조건: 연결한 공급자 `opencode` + `error.name === "APIError"` + 무료 초과 전용 표식. HTTP 429나 `isRetryable`만으로 판별하지 않는다.
- 강한 표식: `error.data.responseBody`를 제한된 크기로 JSON 해석하여 `error.type === "FreeUsageLimitError"` 확인. 원문은 저장·전달하지 않는다.
- 서버 소스는 이 오류를 HTTP **429**, `{ type: "error", error: { type, message }, metadata }`로 직렬화하고 값이 있으면 `retry-after` 헤더(초)를 붙인다.
- 호환 메시지 조건: `data.message`의 `Free usage exceeded` 표식. #72의 `Free usage exceeded, retrying in 11h`는 예시이며 이 설치본의 실제 수신 문구·현행 언어별 문구는 **미확인**이다.
- `ProviderAuthError`, 네트워크 오류, 일반 `RateLimitError`, `GoUsageLimitError`, `BlackUsageLimitError`, 다른 공급자 오류는 무료 초과로 처리하지 않는다.
- `session.error`는 재시도 종료 후 발생할 수 있다. **즉시 한도 감지**가 필요하면 `session.status`의 `properties.status.type === "retry"`도 고려한다.
- 1.18.34 소스의 `status.action.reason === "free_tier_limit"`, `status.action.provider === "opencode"`는 추가 표식이다. 로컬 1.18.29 타입에는 `action`이 없어 런타임 가드가 필요하다.
- CLI는 무료 오류 body 표식을 재시도 안내 `Free usage exceeded, subscribe to Go`로 바꿀 수 있다. `retrying in 11h`만 기다리면 감지를 놓칠 수 있다.
- 재시도 시간은 `error.data.responseHeaders["retry-after"]`의 유효한 초/HTTP 날짜 또는 `retry-after-ms`에서 추출 가능하다. 없는 값·잘못된 값은 **미확인**으로 둔다.
- 문구 호환 파서는 `retrying in` 뒤의 숫자와 `h/m/s`를 엄격히 해석한다(합성 `11h` → 39600초). 실제 해당 문구 추출 성공은 **미확인**이다.
- `status.next`는 다음 CLI 재시도 시각(Unix ms)이며 한도 해제 시각을 보장하지 않는다. 헤더·문구 시간도 관측된 대기 정보로만 저장하고 자동 해제 근거로 쓰지 않는다.
근거: [서버 오류 응답](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/console/app/src/routes/zen/util/handler.ts#L505), [재시도 정책](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/retry.ts), [상태 스키마](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/schema/src/session-status-event.ts).

## 정상 응답 완료와 1회 해제

- 후보 이벤트는 `message.updated`; `info.role === "assistant"`, 유한한 `info.time.completed`, `info.error` 없음, `info.providerID === "opencode"`, 무료 모델 확인을 모두 요구한다.
- 보수적 완료 조건은 `info.finish === "stop"`이다. `tool-calls`·`unknown`·`content-filter`·`error`·완료 전 갱신은 제외한다. 다른 finish의 정상 취급은 **미확인**이다.
- processor는 오류·중단에도 `time.completed`를 기록한다. prompt가 이후 content-filter/구조화 출력 오류를 붙일 수도 있어 완료 시각 하나만으로 해제하면 안 된다.
- 더 엄격한 처리는 세션별 최신 메시지를 유지하고 idle 시점에 후보가 계속 오류 없이 완료인지 재확인한다. `session.idle` 단독은 오류 후에도 발생하므로 성공 증거가 아니다.
- 무료 모델은 읽기 전용 카탈로그의 provider `opencode` 모델 비용(input/output 0)으로 확인한다. `-free` 접미사만 쓰면 무료 `big-pickle`·`grok-code`를 놓친다(로컬 공개 모델 캐시에서 확인).
- 가격 0 메타데이터는 카탈로그 기준이며 미래 가격·계정별 무료 자격은 **미확인**이다. 미등록 모델은 무료로 추측하지 않는다.
- #72 요구: 초기 `unlockPending=true`; 초과 관측 시 true; 첫 정상 완료 보고 성공 후 false. 보고 진행 중 중복 호출을 막고 실패 시 재시도 가능하게 유지한다.
- 한 인스턴스의 여러 세션 이벤트가 겹칠 수 있으므로 메모리 갱신·외부 보고를 직렬화한다. 프로세스 간 멱등성은 yoroi 저장소가 담당한다.
근거: [완료 정리](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/processor.ts#L609), [완료 후 오류 처리](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/prompt.ts#L1295), [idle 발행](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/status.ts), [무료 모델 선택](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/provider/provider.ts#L221).

## 전역 경로·로드·런타임·외부 명령

- [공식 플러그인 문서](https://opencode.ai/docs/plugins/): 전역 `~/.config/opencode/plugins/`, 프로젝트 `.opencode/plugins/`의 JS/TS를 시작 시 자동 로드한다.
- 소스의 전역 기준은 XDG config 하위 `opencode`; `XDG_CONFIG_HOME`이 지정되면 경로가 달라진다. 설치기는 실행 사용자의 경로를 해석해야 한다.
- `OPENCODE_CONFIG_DIR`는 추가 탐색 디렉터리다. `ConfigPaths.directories`에는 기존 전역 경로도 남으므로 단순 대체로 가정하지 않는다.
- 소스 패턴은 `{plugin,plugins}/*.{ts,js}`로 단수 디렉터리도 지원하며 재귀 탐색은 아니다. symlink·숨김 항목을 허용하고 파일 URL로 정규화한다.
- 문서의 순서는 전역 config → 프로젝트 config → 전역 디렉터리 → 프로젝트 디렉터리다. 실제 소스는 경로별 병합 후 npm 패키지명/정확한 파일 URL 기준으로 뒤쪽 설정을 남긴다.
- named async 플러그인 함수 또는 default `{ id, server: async (...) => hooks }`를 사용할 수 있다. 무관한 export는 legacy 로더의 함수 검사에 걸릴 수 있다.
- 로컬 Bun 기반 실행에서 context `$`는 `Bun.$`다. 소스는 Bun이 없으면 `$`가 undefined인 경우도 허용한다. 서버가 원격이면 플러그인·명령도 서버 호스트에서 실행된다.
- 외부 명령은 context `$`의 tagged template과 보간을 사용한다. 예: `await $\`yoroi zen-free report --ok\`. 실제 호출은 이번 조사에서 하지 않았다.
- 출력 억제는 `.quiet()`, 비정상 종료를 값으로 받으려면 `.nothrow()`를 사용하고 `exitCode`를 확인한다. 실행 파일 부재·Promise rejection도 catch한다.
- 이벤트 콜백 Promise는 소스에서 await하지 않는다. 자체 큐·timeout·실패 처리가 필요하며 원문 오류·헤더·대화·토큰을 명령 인수나 로그에 전달하지 않는다.
- 전역 플러그인 실설치(2026-10-10 20:28 KST)는 확인했다. 설치 이후 시작한 opencode 프로세스 2개를 확인했으나(2026-10-11 조사) OpenCode 로그에 플러그인 로드 기록이 없고
  `--ok`는 락이 없으면 DB에 흔적이 없어 **로드·외부 명령 실행 성공은 여전히 미확인**이다. 아래 로드 표시로 확인한다.
근거: [탐색 경로](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/config/paths.ts), [XDG 경로](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/core/src/global.ts), [발견·중복 제거](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/config/plugin.ts), [초기화·이벤트 전달](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/plugin/index.ts).

## 로드 표시 ([#77](https://github.com/qus0in/yoroi/issues/77))

- 플러그인 진입(`yoroi-zen-free.js`)이 로드될 때 기존 `report` 경로로 `yoroi zen-free report --loaded`를 1회 실행한다. 대화·모델·오류·토큰은 전달하지 않는다.
- 호출은 기다리지 않는다(fire-and-forget). `report`는 reject하지 않고 6초 timeout 뒤 강제 종료되며, yoroi 부재·실패·지연이 플러그인 로드와 이벤트 처리를 막지 않는다.
- 저장은 `plugin_loads(scope, loaded_at)` 한 행뿐이다(마이그레이션 v3). `provider_locks`·`lock_events`는 CHECK 제약이 있는 락 전용이라 쓰지 않으며 락 의미(locked/ok/unknown)는 바뀌지 않는다.
  더 늦은 시각만 덮어쓰고 같은 DB에서 v2(캐시·이력)와 독립적으로 적용된다.
- `yoroi zen-free status`는 둘째 줄에 `plugin-loaded: <UTC ISO>`를 표시하고 미기록이면 `plugin-loaded: not recorded`를 표시한다. `--json`에는 `loadedAt`(ISO 또는 `null`)이 추가된다.
  `once`의 Zen 행은 바뀌지 않는다.
- 로드 표시는 프로세스별(인스턴스별) 로드마다 갱신되는 "마지막 로드 시각"이다. 어느 OpenCode 프로세스인지, 세션이 한도 이벤트를 받는지는 알려주지 않는다. 기존 설치본에는 이 표시가 없다. `node scripts/opencode-hook.mjs install`로 다시 설치하고 OpenCode를 재시작해야 처음 기록된다(**미확인**: 실제 로드 기록 성공).

## detect가 읽는 테이블 ([#89](https://github.com/qus0in/yoroi/issues/89))

`yoroi detect`([운영 문서](detect.md))는 아래 테이블을 읽기만 하며 락 의미를 바꾸지 않는다. 커서·중복 억제 표식은 전용 `detect_state`에 저장한다.

| 테이블 | 읽는 열 | 쓰임 |
| --- | --- | --- |
| `lock_events` | `id`·`kind`(exceeded/cleared)·`model`·`observed_at`·`retry_at` | id 커서 이후 전이만 이벤트로 낸다. 첫 실행은 현재 최대 id로 시작 |
| `provider_locks` | `state`·`retry_at`·`model` | locked이고 `retry_at`이 지나면 `retry-passed`(해제 미검증) |
| `plugin_loads` | `loaded_at` | 시작 분 이후 로드 표시가 없으면 `plugin-stale`(시작 시각은 `ps etime`으로 분 단위 추정) |

## 검증과 회고

로컬 버전·타입·예시를 읽고 태그 소스와 비교했다. 모델 요청 및 한도 시험은 0회이며 실제 오류·정상 응답·계정별 reset은 **미확인**으로 남긴다.
회고: CLI/SDK 버전 차이, retry와 최종 error의 차이, idle과 성공의 차이를 계약에 보존해야 오탐과 해제 누락을 줄일 수 있다.
