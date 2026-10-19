# 분배 CLI `coord` 개선 (p62, 2026-10-14 사용자 요청)

목표: 오케스트레이터가 `herdr`를 직접 배우지 않고 스킬 CLI 하나로 분배·상태·전송·감사·감시를 한다.
o(agy `w12:pR`)는 분배·진척만 맡고 구현·문서·검증은 워커가 한다.

## 배정 (p62)

| 담당 | 패킷 | 소유 |
| --- | --- | --- |
| w2 `w12:p0` | scratch/packets/yoroi-p62-w2.json | scripts/coord.py, coord_herdr.py, test_coord.py |
| w3 `w12:p11` | scratch/packets/yoroi-p62-w3.json | SKILL.md, references/playbook.md, docs/orchestration.md |
| w4 `w12:pV` | (w2 보고 후 발행) | 독립 검증·리뷰 보고서 |

경로 접두: `.agents/skills/agent-coordination/`. 소유 외 파일은 읽기 전용.

## CLI 인터페이스 (w2 구현, w3 문서화 — 두 담당 모두 이 절을 계약으로 삼는다)

진입점: `python3 .agents/skills/agent-coordination/scripts/coord.py <cmd> ...`

| 명령 | 동작 | 종료 코드 |
| --- | --- | --- |
| `status` | 로스터 라벨별 `라벨 pane 에이전트 상태 모델표시줄` 한 줄씩. 로스터에 없는 live 에이전트는 라벨 `?` | 0 / herdr 오류 1 |
| `packet <task_id> <label> <owned,...> <criteria,...> [report]` | 라벨→pane 변환 후 `task_packet.py create`에 위임 | task_packet 코드 |
| `send <label> <packet.json>` | 아래 전송 규칙 | 0 성공 / 1 거부·미시작 / 2 인자·라벨 오류 / 3 대기 시간 초과 |
| `audit <packet.json> <report.json>` | `report_audit.py`에 위임 | 위임 코드 |
| `watch <label...> [--reports f...]` | 라벨→pane 변환 후 완료/보고서 감시(300초 누적 예산) | 0(READY) / 3(TIMEOUT) / 4(MISSING) / 5(DEADLINE) / 6(STALE) |

공통 옵션: `--roster <path>`(기본 `docs/orchestration.md`), `--herdr <cmd>`(기본 `herdr`, 테스트 주입용).

### 로스터 (라벨→pane)

- 로스터 문서의 마크다운 표 행 중 1열이 백틱 pane id(`` `w12:p0` ``), 2열이 라벨인 행을 읽는다. 예: `| \`w12:p0\` | w2 | ... |`.
- 라벨 `o (기존 w1)`처럼 괄호 부연은 첫 단어(`o`)를 라벨로 쓴다. 라벨이 없거나 중복이면 exit 2와 후보 라벨 목록을 출력한다.
- 라벨 `o`·`w1`~`w4`가 w12(yoroi)와 w15(smallb) 양쪽에 있다. workspace_id는 pane의 `:` 앞 접두다. 접두가 하나면 그 값을 쓰고, 둘 이상이거나 cwd로 확정할 수 없으면 오류. 같은 라벨이 둘 이상의 workspace에 있으면 첫 번째를 고르지 말고 `ambiguous label 'o': w12/w15`처럼 멈춘다. `--workspace <id>`로 지정하고 확인·대기는 pane id만 사용한다. 해석 로그에는 workspace_id를 라벨·pane과 함께 남긴다.
- 로스터 pane이 `herdr agent list`에 없으면(세션 변경) exit 2로 "로스터 갱신 필요"를 알린다. 추측 전송 금지.

### herdr 사실 (w2만 참조, 문서·규칙에는 노출하지 않는다)

- `herdr agent list` → JSON `result.agents[]`: `pane_id`, `agent`, `agent_status`(idle/done/working/blocked/unknown), `state_change_seq`, `completion_seq`.
- `herdr agent read <pane> --source detection` → 하단 텍스트. 모델 표시줄은 `·`가 포함된 입력창 하단 줄(예: `Build auto · DeepSeek V4.1 Flash · max`). 못 찾으면 `-`.
- `herdr agent prompt <pane> "<text>"` → JSON. 서버 오류는 stderr JSON·exit 1(예: `agent_blocked`). `--timeout`은 `--wait`와 함께만 허용.

### 전송 규칙 (`send`)

1. 패킷을 `task_packet.py validate`로 검사한다. 실패 시 전송하지 않고 exit 2. 패킷 `target_pane`이 라벨 pane과 다르면 exit 2.
2. 상태가 `working`이면 `idle`/`done`까지 폴링 대기(기본 간격 5초, 최대 `--wait-max 600`초, 초과 exit 3).
   `blocked`/`unknown`이면 전송하지 않고 exit 1("사용자 조치 필요, 메신저에 전달").
3. 전송 직전 `state_change_seq`를 기록하고 prompt를 **1회만** 보낸다. 메시지: 패킷 경로·requirements_doc·report_path·금지 규칙 요약.
4. prompt가 exit≠0이거나 오류 JSON이면 exit 1. 성공으로 기록하지 않는다. 재전송하지 않는다.
5. 최대 15초 동안 상태가 `working`/`blocked`로 바뀌거나 `state_change_seq`가 전진하면 `turn_started seq a→b`를 출력하고 exit 0.
   아니면 `not_started` 출력·exit 1(재전송 금지, 화면 확인은 메신저 요청).
6. 성공·실패 모두 `scratch/coord-send.log`(JSONL: 시각·라벨·pane·패킷·결과·seq)에 append한다. 실패를 sent로 쓰지 않는다.

### 테스트 (`test_coord.py`, 가짜 herdr 실행 파일 주입)

필수: 라벨 미존재 exit 2, 로스터 pane 부재 exit 2, busy→idle 후 1회 전송, blocked 거부 exit 1,
prompt 거부(exit 1) 시 실패 기록, seq 미전진 not_started exit 1, 대기 초과 exit 3, status 모델 줄 파싱.
기존 `test_coordination.py`도 통과해야 한다. 각 파일 100줄 이하(초과 시 모듈 분리).

읽기 전용 작업의 보고서는 `modified_files: []`를 허용한다. `report_audit.py`는 변경이 없다는 사실 보고를 거부하지 않는다.

## 규칙 문서 (w3)

- `SKILL.md`·`docs/orchestration.md`에 다음을 넣는다: **분배·상태·전송·감사는 coord CLI로만 한다. `herdr`를 직접 배우거나 원시 명령을 쓰지 않는다.**
  CLI가 다루지 않는 조작(키 입력·화면 읽기·세션 조작)은 직접 하지 않고 메신저(코테츠)에게 요청한다.
- o 역할 집중: o는 분배·진척 파악·막힌 원인 해결·우선순위 조정만 한다. 리뷰·검증·구현은 워커에 패킷으로 인계한다.
  사용자 결정은 메신저에게 올린다. `docs/orchestration.md` 오케스트레이터 절과 현재 구성 표를 갱신한다.
- 스킬은 재사용 가능하게 쓰고 레포 값(pane·로스터 경로)은 docs에 둔다. 기존 `watch_workers.sh` 원시 예시는 coord 예시로 바꾼다.
- 표 형식은 로스터 계약(1열 백틱 pane, 2열 라벨)을 유지한다. 각 파일 100줄 이하.

## 공통 및 완료 판정 불변 원칙

1. **보고서 부재 즉시 포착 (exit 4 REPORT_MISSING)**: 워커가 `done` 상태이거나 감시 중 `working -> done` 전이 시 보고서가 없으면 추가 sleep 없이 즉시 exit 4로 반환하여 산출물·CI를 대조한다.
2. **300초 누적 예산 (exit 5 WATCH_DEADLINE)**: 호스트 5분 규칙에 맞춰 기본 예산은 300초이며, 최초 send 시점(`scratch/coord-send.log`)을 앵커로 삼아 반복 재호출 간 예산을 리셋하지 않는다.
3. **stale 판정 (exit 6 WATCH_STALE)**: send 앵커가 없거나 1시간 이상 경과한 오래된 작업은 exit 6으로 거부한다.
4. **미완료 구분 및 재호출 원칙**: no_report/deadline/stale 신호 수신 시 맹목적으로 watch를 재호출하거나 패킷을 재전송하지 않고, 즉시 reconcile_now 또는 메신저 조치를 수행한다.
5. 커밋·stage·push 금지, 기존 변경 보존, 모델·세션 변경 금지, 5분 단위 진척, 패킷 report_path JSON 작성.
6. 완료 검증: `python3 scripts/validate-repo.py`.
