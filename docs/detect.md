# yoroi detect 운영 ([#89](https://github.com/qus0in/yoroi/issues/89), 0.4.0)

yoroi 안에서 10분마다 도는 감지기다. 외부 cron·Hermes에 맡기지 않는다. 사용자 결정(2026-10-11): 지속성은 pm2, 알림은 stdout만,
usage 호출은 공급자별 예산(15~30분). 설계 판단과 패킷 분해는 [#89](https://github.com/qus0in/yoroi/issues/89)를 따른다.

## watch와의 관계

`watch`는 0.3.0에서 제거됐고 지금도 `yoroi watch`는 exit 2와 제거 안내를 낸다([#83](https://github.com/qus0in/yoroi/issues/83)).
`detect`는 그 방침을 바꾸지 않고 **감지 목적에 한해** 내장 반복을 허용한 것이다. 사용량을 주기적으로 보여 주는 용도가 아니라 이벤트만 알린다.
일반 주기 조회가 필요하면 여전히 외부 스케줄러로 `yoroi once`를 실행한다.

## 명령과 출력

| 명령 | 동작 |
| --- | --- |
| `yoroi detect` | 포그라운드 루프. 시작 즉시 1회, 이후 600초(10분) 고정 주기(밀린 틱은 건너뜀) |
| `yoroi detect --once` | 한 사이클만 실행하고 종료(점검·테스트용) |
| `yoroi detect [--once] --json` | 이벤트마다 JSON 한 줄(`source` 필드 포함) |
| `yoroi detect status [--json]` | 마지막 하트비트·연령·임대 상태 |

- stdout에는 이벤트만 한 줄씩 나온다. 진단은 stderr에 `detect: <컴포넌트>:<코드>` 형태로만 나온다(메시지·경로·자격 증명 없음).
- 종료 코드: 정상·SIGINT·SIGTERM 0, 인자·설정 오류 2, status 저장소 오류·루프 예기치 못한 중단 1. 스스로 데몬화하지 않는다.
- 종료 시 단일 실행 임대를 풀어 재시작이 곧바로 이어진다.

## 사이클 10분 vs 공급자 호출 15~30분

- 감지 **사이클**은 10분마다 이벤트 유무와 무관하게 돈다(로컬 DB 읽기·평가·하트비트 갱신).
- 공급자 **호출**은 429 위험 때문에 예산을 따른다: Ollama Pro·OpenCode Go 15분, Claude·Codex·AGY 30분. 예산 안에서는 이력의 최신 샘플을 재사용한다.
  사용자가 직접 돌린 `yoroi once` 샘플도 최신 샘플로 인정해 다음 호출을 늦춘다.
- 사이클이 10분 단위이므로 실제 호출 간격은 예산을 10분 단위로 올린 값이다(15분 예산 → 20분마다, 30분 예산 → 30분마다).
- 429·unavailable·timeout·network는 15→30→60분 쿨다운으로 저장되어 재시작 뒤에도 유지된다. 429에 `Retry-After`가 있으면(OpenCode Go·Claude·Ollama Pro) 그 값이 지수 쿨다운을 대신하되 공급자 간격보다 짧아지지 않고, 값이 아무리 커도 쿨다운은 최대 24시간으로 자른다.
- Claude는 macOS Keychain을 **실제 호출 때만** 읽는다. 재사용 사이클은 Keychain도 공급자도 건드리지 않는다.
- 임계: 급증 +20%p, 샘플 정체 90분. 값은 상수다.

## 이벤트

| 소스 | 이벤트 | 뜻 |
| --- | --- | --- |
| zen | `exceeded`·`cleared` | `lock_events`에 새로 기록된 전이(첫 실행은 과거를 재방송하지 않음) |
| zen | `retry-passed` | 기록된 재시도 시각이 지났다. 해제는 실제 정상 응답(`--ok`) 전까지 미검증 |
| zen | `plugin-stale` | 최신 OpenCode 시작 후 10분이 지났는데 그 시작(분 단위) 이후의 로드 표시가 없다. 같은 시작·같은 로드 상태에는 한 번만 나온다 |
| usage | `exhausted`·`recovered` | `remaining 0` 또는 `percent>=100`, 이후 값 하락·reset 이동 |
| usage | `surge`·`stale`·`resumed` | %p 급증, 샘플 정체, 정체 해소 |
| detector | `gap` | 이전 감지기의 하트비트가 끊긴 뒤 인계됨(재부팅·충돌) |

알림은 한 번만 간다(전달 최대 1회). 충돌로 줄 출력 전에 죽으면 그 알림은 유실될 수 있으며 `yoroi zen-free status`에는 남는다.

## 읽고 쓰는 데이터

- 읽기: `lock_events`·`provider_locks`·`plugin_loads`([계약](contracts-opencode-zen-free.md)), usage 이력 `observation_samples`·캐시.
- 쓰기: `detect_state`(커서·상태·예산)·`detect_lease`(임대)와, 예산이 허락한 호출의 기존 캐시·이력. OpenCode 로그·대화는 읽지 않는다.

## 실행·중지·복구 (pm2)

예시 설정은 [integrations/pm2/yoroi-detect.config.cjs](../integrations/pm2/yoroi-detect.config.cjs)다. 이 저장소는 pm2에 등록하지 않으며 pm2 동작은 여기서 검증하지 않았다.
등록은 사용자가 직접 한다. 공급자 인증은 pm2를 시작한 셸의 환경을 쓰므로 설정 파일에 비밀을 넣지 않는다.

```bash
pm2 start integrations/pm2/yoroi-detect.config.cjs   # 등록·시작
pm2 logs yoroi-detect                                # stdout=이벤트, stderr=진단
pm2 stop yoroi-detect                                # SIGTERM → 임대 해제
pm2 delete yoroi-detect                              # 등록 해제
```

- 재시작·재부팅 복구는 pm2의 `save`·`startup` 안내를 따른다. `gap`은 이전 감지기가 임대를 풀지 못하고 끊긴 뒤 인계될 때만 나온다(정상 종료 뒤 재시작에는 없음).
- 이전 프로세스가 비정상 종료하면 임대가 최대 20분(2×주기) 남는다. 새 감지기는 stderr에 한 번 안내하고 기다렸다 인계한다.
- `status`: `running`=임대 유효, `stopped`=하트비트가 20분 넘게 없음, `no active detector`=기록 없음 또는 정상 종료.
- DB가 잠겨 있으면 해당 사이클의 컴포넌트 오류만 stderr에 나오고 다음 사이클에 재시도한다.

## #77·#88 관측과 한계

- 감지기는 **한도를 유발하지 않는다.** [#88](https://github.com/qus0in/yoroi/issues/88)은 자연 발생한 초과·해제를 기다린다. 발생하면 `exceeded`→`cleared` 줄(시각·모델·retry)이 근거다.
- [#77](https://github.com/qus0in/yoroi/issues/77)의 로드 확인은 `yoroi zen-free status`의 `plugin-loaded`로 한다. 합성 테스트는 이슈 완료를 대신하지 않는다.
- 한계: 임계·주기 상수. `plugin-stale`은 `ps -axo etime=,comm=` 한 번(사이클당, 읽기 전용, macOS·Linux 공통)으로 가장 최근 OpenCode 시작을 분 단위로 추정하므로 ±1분 오차가 있고, ps가 실패하면 그 사이클은 판정을 생략한다.
