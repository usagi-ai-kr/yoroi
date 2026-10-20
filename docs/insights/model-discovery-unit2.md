# #168 모델 자동감지 순수 핵심 구현 (단위2, 2026-10-20)

- 담당 w3(w18:p4). 요구: `docs/insights/issue-followup-20261020.md` §w3. 선행 설계: `model-discovery-unit1.md`.
- 소유: `src/insights/model-discovery-{types,diff,eligibility,snapshot,render}.ts`,
  `tests/insights-model-discovery{,-snapshot,-snapshot-invalid}.test.ts`, 이 문서. 그 외 파일 무수정.
- 본 단위는 순수 계약만 — 스키마·수집·어댑터·저장소 구현·config·catalog·once·레터 연결 없음.

## 1. 구현 계약

| 파일 | 책임 | 공개 계약 |
| --- | --- | --- |
| `model-discovery-types.ts` | 타입 + discovery 정규화 | `DiscoveredModel`·`ModelDiscoveryDiff`·`ModelRegistrySnapshot`·`ModelRegistrySnapshotStore`·`DiscoveryDiffSummary`·`normalizeDiscoveryModelId` |
| `model-discovery-eligibility.ts` | 후보 편입 게이트 | `modelEligibilityReasons`·`checkEligibility`·`isEligibleModel`·`isValidModelId`·`isValidSourceUrl`·`isValidCheckedOn` |
| `model-discovery-diff.ts` | 기준 대비 차이 | `diffRegistry`·`diffProviderSnapshots`·`summarizeDiscoveryDiffs` |
| `model-discovery-snapshot.ts` | 세대 선택·last-good | `SNAPSHOT_MAX_AGE_MS`·`selectSnapshot`·`buildSnapshot`·`resolveCollection`·`parseInstant` |
| `model-discovery-render.ts` | stdout 1줄 | `renderDiscoveryDiffLine`·`renderDiscoveryDiffNotice` |

## 2. 신뢰 경계 (이 단위의 핵심)

- **verified는 입력 사실이다.** 코드가 `true`를 부여하거나 승격하지 않는다. 입력 객체도 변경하지 않는다.
- **URL 모양은 공식 확인을 대체하지 않는다.** `isValidSourceUrl`은 https+host 모양만 본다. 공식성은 `verified` 사실로만 온다.
- **정규화는 discovery 전용 최소 규칙**(소문자·공백→하이픈). 날짜형 suffix·벤더 prefix·등급 순서를 제거하지 않아 `deepseek-v4-pro-20260813`≠`…-20260901`로 남는다. 레터 정규화와 의도가 다르며 그 차이를 테스트로 고정한다.
- **fail-closed 사유**: `invalid-model-id`·`duplicate-model-id`·`unverified`·`invalid-source-url`·`invalid-checked-on`·`missing-tier`·`missing-effort`. 하나라도 걸리면 편입 불가.
- **중복 id는 id 전체를 거부**(어느 항목인지 모호). diff에서도 added·removed·changed 전부 보류해 허위 폐지·신규 신호를 막는다.
- **provider 분리**: `diffProviderSnapshots`는 providerId별 비교만 한다. 모델이 provider 경계를 넘지 않는다.
- **배열 필드는 집합 비교**: `planIds`·`efforts`는 정렬·중복 제거 후 비교해 순서·중복만 다른 목록을 무변경으로 본다. snapshot 모델 순서도 id 오름차순으로 고정한다.

## 3. snapshot 규칙 (차단 반영 후)

- 30일은 `SNAPSHOT_MAX_AGE_MS` 상수(config 노출 없음). **정확히 30일=usable, 1ms 초과=expired** (경계 정확).
- 미래 시각·무효 시각·세대 0 이하는 거부(future·invalid). **nowMs가 유한하지 않으면 판정 불가(invalid)** — NaN·Infinity는 usable로 떨어지지 않는다.
- **30일 게이트는 build에도 적용된다**: 관측시각이 30일을 넘은 성공 회차는 새 세대를 만들지 않고 reason=expired다(만료 관측을 usable로 만들지 않는다).
- **수집 실패·무효·미래·만료 회차는 세대 교체를 하지 않는다**: `resolveCollection`이 유효 last-good을 그대로 보존한다(changed=false). 회차 사유(reason)는 그대로 알린다.
  - 회차 사유와 last-good 상태는 구분한다: 실패+유효 last-good→`failed`, 실패+만료 last-good→`expired`, 실패+무효 last-good→`invalid`, last-good 없음→`missing`.
  - 무효·미래·만료 **성공** 회차도 reason은 invalid·future·expired로 두고 유효 last-good을 보존한다(대입형 호출자가 last-good을 잃지 않는다).
- **provider 격리**: 직전 스냅샷은 요청 provider와 같을 때만 last-good으로 재사용한다. 다른 provider의 스냅샷을 반환하거나 세대를 승계하지 않는다(새 provider의 세대는 1부터).
- 성공 회차는 같은 provider의 직전 세대에서만 generation+1. 모델 순서는 id 오름차순 고정.

## 4. stdout 알림

- 형식: `<observedAt> discovery registry-diff providers=N added=N removed=N changed=N`. 변경이 없으면 `renderDiscoveryDiffNotice`가 undefined(무출력). 알림 채널은 stdout 한 줄뿐 — 새 알림 채널·인프라 없음.
- provider id·모델 id·경로·크리덴셜은 줄에 넣지 않는다. 제어문자(ANSI 포함) 제거·64자 제한(중계: `src/ui/cli/detect-render.ts`).

## 5. 미구현(범위 밖, 명시)

- provider 어댑터·수집·HTTP 호출·원시 스키마, 스냅샷 저장소 구현체(`ModelRegistrySnapshotStore`는 타입만),
  `config/letter-model-lists.json`의 `discovery` 섹션(파일에 손대지 않음), `plan-catalog`·후보풀·`once`·레터 연결.
- 미결 정책은 만들지 않는다: 폐지 grace(연속 부재 횟수)·새 설정 의미·가중치. `removed`는 '이번 수집 부재' 표기일 뿐이다.

## 6. AC → 테스트 매핑 (합성 fixture)

| AC | 테스트(파일:test) |
| --- | --- |
| 정규화 최소 규칙·날짜형 id 구분 | discovery.test.ts: 정규화는 소문자·공백만 바꾼다 |
| 5개 메타데이터 충족 시에만 편입 | discovery.test.ts: 편입 게이트는 5개 메타데이터를 요구한다 — URL 모양은… |
| URL 모양≠공식 확인·verified 불변 | 위 테스트와 동일 케이스(같은 id를 두 번 검증) |
| ID 중복 fail-closed | discovery.test.ts: 같은 id가 중복되면 그 id 전체를 거부한다 |
| 추가·부재·변경 분리 | discovery.test.ts: diff는 추가·부재·변경을 분리한다 |
| 순서·중복만 다른 목록=무변경·유사명 무병합 | discovery.test.ts: 순서·중복만 다른 목록과 유사 이름은 허위 변경이 아니다 |
| provider 분리 | discovery.test.ts: provider별로 비교를 분리한다 |
| stdout 1줄·무변경 무출력·제어문자 제거 | discovery.test.ts: stdout 알림은 1줄이며…, 알림 줄은 제어문자를 제거하고… |
| 30일 만료·미래시각·경계 | snapshot.test.ts: 30일 경계는 정확히 30일이면 유효하고…, 스냅샷 판정… |
| 수집 실패 last-good 보존 | snapshot.test.ts: 수집 실패는 last-good을 그대로 보존한다, 실패인데 last-good이 없거나 만료면… |
| 세대 증가·순서 고정 | snapshot.test.ts: 성공한 수집은 세대를 1 올리고…, 순서만 다른 모델 목록은 같은 세대 내용이다 |
| 무효·미래·만료 성공 회차의 last-good 보존 | snapshot-invalid.test.ts: 무효·미래·만료 관측의 성공 회차는 유효 last-good을 보존한다 |
| build에도 30일 게이트 | snapshot-invalid.test.ts: 만료 관측은 build 단계에서 거부된다 — 30일 게이트가 build에도 적용된다 |
| provider 격리(재사용·승계 금지) | snapshot-invalid.test.ts: 다른 provider의 current는 재사용하지 않는다…, 다른 provider의 세대를 승계하지 않는다 |
| nowMs 유한성 거부 | snapshot-invalid.test.ts: nowMs가 유한하지 않으면 판정 불가(invalid)다 |
| 실패 입력과 만료·무효 last-good 구분 | snapshot-invalid.test.ts: 실패 입력과 만료·무효 last-good을 구분한다 |
| 무효 previous 세대 승계 금지 | snapshot-generation.test.ts: invalid previous generations…, valid previous generation still inherits |
| 중복 id 양방향 허위 added/removed 금지·정상 id 변경 보존 | discovery.test.ts: 모호 id는 added/removed/changed 모두 보류하고 정상 변경은 보존한다 |

## 6-1. 차단·추가 지적 반영 기록 (2026-10-20)

| 지적 | 위치 | 반영 |
| --- | --- | --- |
| 차단1 — 잘못된 성공이 last-good을 버짐 | snapshot.ts `resolveCollection` | 무효·미래·만료 build에서 유효 last-good을 snapshot으로 반환하고 reason은 회차 사유 유지, changed=false |
| 차단2 — 40일 전 관측이 즉시 usable | snapshot.ts `buildSnapshot` | build에 30일 게이트 적용(expired 거부). `resolveCollection` 단일 경로로 닫힘 |
| 총괄 추가1 — provider 불일치 current 반환 | snapshot.ts `lastGoodFor` | provider가 다르면 last-good 재사용 금지(사유 missing), 성공 시 이전 세대 승계 금지(새 provider=1세대) |
| 총괄 추가2 — `selectSnapshot(current, NaN)`이 usable | snapshot.ts `selectSnapshot` | nowMs 비유한 시 invalid로 거부 |
| 리뷰 추가 — 무효 previous 세대(-1·NaN·2.5·0) 승계 | snapshot.ts `buildSnapshot` | 정수 1 이상만 승계, 그 외는 1세대부터(무효 usable 세대 방지) |
| 총괄 재현 — 중복 id가 허위 removed/added | diff.ts `ambiguousIds` | 양쪽 목록 중 하나라도 중복인 id는 해당 diff의 added·removed·changed에서 보류(eligibility 중복거부 유지, 다른 정상 id 변경은 보존) |

- 타입·공개 함수 시그니처·호출자 변경 없음. 새 정책·리팩터링 없음. types·eligibility·render는 미변경.

## 7. 검증 결과 (차단 반영 후 재실행)

- `pnpm run typecheck` → **exit 0**(내 파일 오류 0건. 앞선 기록의 `arena-coding-parser.ts` TS2367은 w1 수정으로 해소).
- 집중 테스트 **24건 PASS / 0 fail** — `node --import ./tests/harness-setup.mjs --import tsx --test "tests/insights-model-discovery*.test.ts"`
  (discovery 9 + snapshot 7 + snapshot-invalid 6 + snapshot-generation 2). 신규 회귀는 4개 지적 경로와 중복 id 양방향 허위신호를 직접 덮는다.
- 재현 확인(직접 실행): 무효 관측 성공→`{gen:1, provider-a, reason:'invalid', changed:false}` / 40일 전 build→`expired`(스냅샷 없음) /
  provider 불일치+실패→`{snapshot:null, reason:'missing'}` / provider 불일치+성공→`generation 1, provider-b` / `selectSnapshot(NaN)`→`invalid` /
  `diffRegistry([m],[m,m])`·`([m,m],[m])`→`added·removed·changed` 모두 0건, 다른 정상 id의 추가·제거는 유지.
- `python3 scripts/validate-repo.py` → PASS(100줄 이하 유지). `git diff --check` → 통과.
- 최종 전체 결과: [검증 기록](final-validation-20261020.md). 기본 병렬 시간 단언 1건 실패, 직렬 전체 통과. 원격 CI 미실행.

## 8. 미확인·확인 필요(단위1 §11과 동일, 변경 없음)

- effort 게이트를 문자의 그대로 적용하면 공식 effort 미공개 제공자는 자동 편입 불가다(선택 조건 여부는 사용자 확인 대기). 폐지 grace·스냅샷 저장 위치(레포 파일 vs XDG state vs 기존 SQLite)는 미결 — store 타입만 정의한다.
- 공식 JSON 모델목록을 공개한 제공자는 현재 확인되지 않았다(본 단위에서는 제공자별 공식 수집 경로 및 인증 조건 미검증). 어댑터는 후속 단위.
