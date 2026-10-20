# 시간 제한에 민감한 테스트

2026-10-11 기록. 임계값·테스트 로직은 유지한다. 시간 초과를 기록했다고 검증을 통과로 바꾸지 않는다.
아래 CI 이력은 작업 인계 패킷의 기록이며, 이번 문서 작업에서 원격 CI를 재실행하지 않았다.

## SQLite 경합: `tests/sqlite-lock-contention.test.ts`

- 조건: 외부 연결이 `BEGIN IMMEDIATE`를 유지한 채 4개 캐시 hit와 1개 miss를 수집한다.
  수집 구간의 실측 시간이 **600ms 미만**이어야 하며, 실패한 쓰기가 조회·캐시를 망가뜨리지 않아야 한다.
- p5 Codex 환경에서 반복 **928~1557ms**로 실패했다. 최종 감사의 단독 순차 3회도
  **1557.258 / 1094.802 / 1228.311ms**, 전체 실행은 **1418.389ms**로 실패했다.
- 문서 인계 후 같은 환경 단독 3회도 **1385.169 / 1187.146 / 1459.677ms**로 실패했다.
- p6의 다른 환경 단독 3회는 **272.4 / 278.3 / 266.3ms**로 통과했다. 인계 기록의 CI도 약 **270ms**다.
- 판정: 환경 간 차이가 있으며 p5 환경에서는 단독으로도 재현된다. 단순 병렬 부하 때문이라고 확정할 수 없다.
  시간 단언이 기능 단언보다 먼저라 시간 초과 실행으로 후속 기능 검증 통과까지 주장하지 않는다.
- 대응: 전체 실패 로그와 같은 환경의 단독 3회 시간을 함께 남긴다. 동일 커밋의 다른 환경·CI 결과와 비교한다.
  단독에서도 계속 실패하면 환경 차이를 조사하며, 기능 단언 실패나 새로운 오류는 별도 결함으로 다룬다.
- 2026-10-14 p55 계측: 지연은 miss 1건의 쓰기 2회(`cache.set`, `history.record`)가 각각 busy_timeout 100ms를 기다린 몫이다(hit 4건은 쓰기 없음).
  수정 전에는 일반·Codex seatbelt 모두 각 쓰기 약 118–147ms, 합계 248–290ms였고 824–1548ms는 재현되지 않았다.
  SQLite 기본 busy handler는 실제 경과가 아니라 명목 sleep 합으로 timeout을 센다. 그래서 sleep이 늘어지는 환경에서는 쓰기 1회 대기가 100ms를 넘을 수 있다.
  이를 막도록 usage 캐시·이력의 읽기·쓰기(`queryObservations` 제외)를 `withBusyDeadline`(호출 동안만 busy_timeout 0, 5ms 폴링, 벽시계 100ms 기한)으로 감쌌다.
  연결의 busy_timeout 값 100은 유지한다. 수정 후 각 쓰기 95–103ms, 합계 194–199ms(일반·seatbelt), 테스트 단독 5회 257–282ms로 통과했다.

## CLI 프로세스: `tests/cli-process.test.ts`

- 조건: Node/tsx로 실제 CLI 자식 프로세스를 시작하고, 존재하지 않는 Codex 실행 파일로 종료 코드 1과
  `not-installed` 출력·빈 stderr를 확인한다. 해당 테스트 제한은 **3000ms**다(신호 테스트는 별도 2000ms).
- 인계 기록: main CI [run 38116365419](https://github.com/qus0in/yoroi/actions/runs/38116365419)에서
  3000ms 시간 초과가 **1회** 있었으며 재실행은 통과했다.
- 2026-10-12 main CI [run 38203425496](https://github.com/qus0in/yoroi/actions/runs/38203425496)(`ae7cd83`, v0.6.0 머지)에서 3050ms 시간 초과 1회,
  같은 커밋 재실행(attempt 2) 통과. PR CI 2회·로컬 전체 검사는 통과. 누적 2회.
- 판정: 이력상 일시적 시간 초과 후보다. 1회 실패·재실행 통과만으로 원인이나 항상 안전함을 확정하지 않는다.
- 대응: 같은 커밋에서 단독 실행과 CI 재실행 결과를 기록한다. 반복 시간 초과·출력·종료 코드 불일치는
  프로세스 시작/종료 경로를 조사할 근거다. 제한 확대·skip으로 숨기지 않는다.

## SQLite WAL 동시 첫 열기: `tests/sqlite-migration-concurrency.test.ts`

- 조건: detect·Zen·usage가 같은 새 DB를 동시에 처음 연다. 각 연결은 busy_timeout 설정 뒤 `PRAGMA journal_mode = WAL`과 마이그레이션을 수행한다.
- 초기 코드 판정(재오픈 전): WAL 전환은 `withMigrationRetry` 호출 안에 있었다. `errcode === 5`(SQLITE_BUSY)만 최대 3회 시도하고, 다음 시도 예상치가 시작 후 900ms 미만일 때 재시도했다. 재시도 사이 대기는 10ms였으며 SQLITE_LOCKED(6)는 재시도하지 않았다.
- 2026-10-12 로컬 단독 반복: detect·Zen·usage 3자 경합 테스트 20회, **20/20 통과**. 매회 내부 20라운드로 400개 동시 초기화 라운드에서 누락 테이블 및 `database is locked` 실패 0회. 전체 반복 시간은 약 1.45–2.01초/회였다.
- 초기 판정·대응(재오픈 전): 로컬 단독 반복에서 재현하지 못해 3자 경합 테스트만 유지하고 시간·재시도 상한을 보존했다. CI 원문 로그가 없어 오류 코드는 당시 미확인이었다.
- 2026-10-12 CI [run 38247171932](https://github.com/qus0in/yoroi/actions/runs/38247171932) attempt 1은 `tests/detect-state-store.test.ts`의 lease 경합·첫 열기 2건이 실패했고 attempt 2는 성공했다. WAL 예외는 `code=ERR_SQLITE_ERROR`, `errcode=5`(SQLITE_BUSY), `errstr='database is locked'`였으며 SQLITE_LOCKED(6)은 이 로그에서 관측되지 않았다. 같은 attempt의 `tests/sqlite-migration-concurrency.test.ts` 20라운드는 통과했다.
- 원인·수정: `busy_timeout`은 WAL 전환 전 적용됐고 전환도 retry 블록 안이었지만, 100ms timeout 연결에서 시도 상한 3회가 약 300ms 만에 먼저 소진되어 900ms 예산을 활용하지 못했다. 최대 6회로 늘리고, extended 5/6 코드·SQLite busy/locked 문자열도 분류하며, 현재 모드가 WAL이면 전환 호출을 생략한다. 900ms 예산과 10ms 대기는 유지했다.
- lease 경합 테스트는 3회 각각 `START_AT`까지 약 1초 기다려 총 3604ms가 걸렸으며 별도 테스트 시간 제한 실패는 아니다. 실패는 자식 오류 출력 마지막 줄 `Node.js v24.13.1`을 JSON으로 파싱한 것이고, 같은 attempt에서 WAL 잠금으로 자식이 종료된 별도 첫 열기 실패가 확인됐다.
- 수정 전 강화 로컬 스트레스: CPU 바운더 2개와 DB당 8개 프로세스(detect·Zen·usage 혼합), 새 DB 12라운드(96회 첫 열기)에서 실패 0회. 로컬 무재현은 CI attempt 1 실패를 반박하지 않는다.
- 수정 후 검증: 같은 CPU·프로세스 스트레스 96회에서 실패 0회, WAL 첫 열기와 lease 경합 CI 실패 테스트 각각 20/20 반복 통과. 로컬 `tsc -p tsconfig.json --noEmit` 통과; pnpm 경로는 고정 버전 서명 확인을 위한 registry fetch 실패로 실행되지 않았다. 테스트 임계값은 바꾸지 않았다.

## 사용량 캐시 타임아웃: `tests/usage-history-store.test.ts`

- 2026-10-20 전체 `pnpm run check` 1회차 관측: 1166개 단위 테스트 중 1165개 통과, 1건 실패.
- 실패 상세: `usage-history-store.test.ts:84`의 `<1000ms` 시간 단언이 **1278.628ms**로 실패 (`fails within the 100ms cache timeout, not the 2000ms default`).
- 단독 검증: 동일 환경에서 `node --import ./tests/harness-setup.mjs --import tsx --test tests/usage-history-store.test.ts` 순차 3회 실행 결과 모두 **6/6 통과** (해당 케이스 실측 각 **788.825ms / 794.284ms / 813.215ms**).
- 판정: 임계값 및 테스트 코드는 수정하지 않음. 부하에 따른 일시 지연 가능성이 있으나 원인을 단순 부하로 확정하지 않으며 실패를 숨기지 않는다.
- 재실행: 전체 `check` 1회 재실행 결과 단위 1166/1166 통과, BDD 45/635 통과, typecheck 및 build 모두 exit 0으로 통과함.

## 재현 명령과 결과 기록

레포 루트에서 실행한다. 아래 명령은 합성 입력과 없는 실행 파일을 사용하며 실제 계정 API를 부르지 않는다.

```bash
pnpm run check
node --import ./tests/harness-setup.mjs --import tsx --test tests/sqlite-lock-contention.test.ts
node --import ./tests/harness-setup.mjs --import tsx --test tests/cli-process.test.ts
```

- SQLite 단독 명령을 순차로 3회 실행한다. 전체 검사와 중첩 실행하지 않아 결과 해석을 분명히 한다.
- 커밋·OS·Node 버전·실행 환경·동시 검증 유무·종료 코드·실측 시간·실패 단언·재실행 여부를 남긴다.
- 전체 `check`가 테스트에서 멈추면 미실행 BDD·빌드는 따로 실행하고 각각 결과를 보고한다.
- 임계값 변경이나 테스트 로직 수정은 별도 승인·근거가 필요한 작업이며 이 문서 범위에 포함하지 않는다.


## 같은 단원 최종 상태 보완 (2026-10-20)

- 중복 ID 보완 후 기본 병렬 전체는 1166/1167, 같은 usage-history-store 시간 단언이 1050.631ms로 재발했다.
- 같은 최종 코드의 test-concurrency=1 전체는 1167/1167·BDD45/635·타입·빌드 통과. 임계값/테스트/제품 코드 변경 없음.
- 기본 병렬 게이트 실패는 남아 있다. 직렬 통과만으로 부하가 근본 원인이라고 확정하지 않는다.
- 전체 명령·단독 3회·이전 통과 이력은 [최종 검증](insights/final-validation-20261020.md)에 기록했다.
