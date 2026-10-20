# 위탁 우선 하네스 변경 독립 리뷰 (2026-10-20)

- 리뷰: w3(w18:p4). 대상: w1의 하네스 변경 4파일
  (`.agents/skills/agent-coordination/SKILL.md`, `.agents/skills/coordination-rules/SKILL.md`,
  `docs/orchestration.md`, `docs/insights/delegation-first-20261020.md`) + 보고서 `/tmp/yoroi-delegation-harness-report.json`.
  **구현 파일은 읽기 전용** — 수정 0건. 검증은 직접 재실행.
- **판정: PASS — 차단 없음.** 권고 2건(1 MEDIUM·1 LOW)을 함께 기록한다. 커밋·원격 쓰기 없음.

## 1. 판정 항목별 근거

| 항목 | 결과 | 확인 내용(직접 확인) |
| --- | --- | --- |
| 위탁 우선 | PASS | `agent-coordination` 9항 신설: "직접 처리는 1회성 조회·단일 조작에만 둔다. 상세 원인조사·반복 gh 작업·외부 보고 초안은 워커/리뷰어 위탁이 기본" — delegation 우선이 기본값으로 명시 |
| 직접 처리 예외 좁힘 | PASS | 같은 9항에서 예외는 "사용자 명시 직접 요청·즉각 장애 조치" 2종으로 한정 + "근거·범위를 짧게 기록하고 그 건에만 둔다". "busy 시 대기열·후속 패킷 예약"으로 직접 구현 대체도 금지 |
| 전체 check 워커 위탁 | PASS | `docs/orchestration.md` 4항: "긴 테스트·빌드는 백그라운드·기존 워커로 유도" + 하단 기록: "커밋 전 워커가 전체 check를 돌리고 다른 워커가 리뷰한 결과를 오케스트레이터가 취합한다" — 기존 "오케스트레이터가 직접 돌린다"에서 교체됨 |
| 서브에이전트 금지 | **부분 (F1)** | 금지 문구는 `docs/orchestration.md` 4항에만 존재. `agent-coordination` 2항("긴 테스트·빌드는 서브에이전트나 백그라운드로")·4항("일부 서브에이전트는 …허용한다")과 `AGENTS.md:14`("일부 서브에이전트를 허용한다")는 그대로 → 규칙 불일치 |
| 중복 규칙 | PASS | `coordination-rules` 2항은 "직접 처리의 반복·확장은 agent-coordination 위탁 우선 규칙을 따른다"는 참조 1줄로 확장 — 규칙 본체는 skill 1곳(9항)에만 존재 |
| 100줄 이하 | PASS | 직접 측정 91 / 38 / 100 / 25줄 (모두 ≤100). `AGENTS.md`·`README.md`·`CLAUDE.md` 미변경(git status 빈 출력) |
| 검증 사실 | PASS(부분 재확인) | `validate.sh` 2스킬 PASS(직접 실행), `check-portability.sh` 위반 0건(직접 실행), `git diff --check` 통과. 원격 CI 미실행 — 보고서와 동일하게 로컬 통과만 기록 |

## 2. 권고(차단 아님) + 보완 결과

**F1 (MEDIUM) — 서브에이전트 금지가 규칙 파일 간 불일치 → 보완 완료(2026-10-20, 사용자 명시 지시 기준)**
- 위치: `docs/orchestration.md:41`(금지) ↔ `.agents/skills/agent-coordination/SKILL.md:26,29`(허용) ↔ `AGENTS.md:14`(허용, 사용자 소유).
- 사실: 같은 규칙 사본이 서로 반대 방향을 말하고 있었다. 오케스트레이터는 문서만으로 방향을 확정할 수 없었다.
- **보완**: 최신 사용자 명시 지시("서브에이전트 허용 문구 삭제")에 따라 `agent-coordination` 2·4항에서 **허용 문구를 삭제**했다 —
  2항 "긴 테스트·빌드는 **백그라운드로 돌리고 기존 패널 워커에게 위탁**", 4항 "백그라운드는 메신저 요청 누락 방지를 위해 쓸 수 있다. **서브에이전트·새 패널은 쓰지 않고** 기존 패널 안에서 재배정".
  중립화·조건부 허용 조항은 남기지 않았다(허용=삭제, 금지=호스트 지시 유지). 새 승인 흐름도 만들지 않았다.
- `AGENTS.md`의 "·일부 서브에이전트를 허용한다" 삭제는 **사용자 명시 요청**에 근거해 w1이 별도 수행했다(본 워커는 읽기 전용).
- `docs/orchestration.md`·`coordination-rules`·`README.md`는 수정하지 않았다(오케스트레이션 4항은 이미 금지 문구만 있어 변경 불필요).
  일반 스킬에 repo·pane·model 값도 넣지 않았다(기존 placeholder만 유지). 하네스 소유권은 w1 → 본 워커로 이양(커밋은 총괄).
- **잔여(소유 밖)**: `.agents/skills/agent-coordination/references/playbook.md:48-49`에 서브에이전트 허용·유도 문구가 남아 있다. 본 패킷 소유 목록 밖이라 수정하지 않고 보고만 한다(총괄 배정 필요).

**F2 (LOW) — 문서 수치 오기 → 보완 완료**
- `docs/insights/delegation-first-20261020.md:19`의 "94/39/100줄" → 실제 "**91/38/100/25줄**"로 정정(원 문서 소유권 이양 후 본 워커가 수정).

## 3. w1의 AGENTS·playbook 삭제분 독립 리뷰 (2026-10-20)

- **자기 수정 금지 원칙에 따라** 본 리뷰는 w1이 작성한 `AGENTS.md`·`.agents/skills/agent-coordination/references/playbook.md` 변경분만 검토했다
  (본 워커가 수정한 `agent-coordination/SKILL.md` 2·4항은 자기 리뷰 대상이 아니며, 별도 패킷의 총괄 위탁 리뷰 대상).
- `AGENTS.md`: "메신저 요청 누락 방지를 위한 백그라운드·**일부 서브에이전트를 허용한다**" → "백그라운드를 허용한다" (허용 삭제 1건, 그 외 변경 없음).
- `playbook.md:48-49`: 허용·유도 2문구를 "백그라운드나 기존 워커 위탁"·"백그라운드는 …허용하고, 작업은 기존 패널 안에서 재배정"으로 교체(조건부 허용 없음).
- **전수 검색 결과**: 적용 규칙 파일(AGENTS.md·SKILL.md·coordination-rules.md·playbook.md·docs/orchestration.md)에 서브에이전트 **허용 문구 0건**.
  잔여 언급은 SKILL.md:29·orchestration.md:41의 **금지** 문구 2곳뿐이다. `docs/insights/*`의 과거 기록 7파일은 기록이므로 삭제하지 않았다.
- **보존 확인**: 백그라운드 허용·기존 패널 워커 위탁 문구는 5개 규칙 파일에 그대로 남아 있다. README 무변경. 다른 AGENTS 항목 변경 없음.
- 검증: `validate.sh` PASS · `check-portability.sh` 위반 0건 · `validate-repo.py` PASS · `git diff --check` clean (w1 보고서 값과 일치, 독립 재실행).

## 4. 재확인 명령·exit (보완 후 재실행)

- `bash .agents/skills/skill-authoring/scripts/validate.sh .agents/skills/agent-coordination 100` → PASS
- `bash .agents/skills/skill-authoring/scripts/validate.sh .agents/skills/coordination-rules 100` → PASS
- `bash .agents/skills/skill-authoring/scripts/check-portability.sh .agents/skills` → 위반 0건
- `git diff --check` → exit 0. `git status --short AGENTS.md README.md CLAUDE.md` → 빈 출력(미변경)
- `python3 scripts/validate-repo.py` → **FAIL 1건: `src/insights/plan-catalog.ts` 101줄**. 본 하네스 변경과 무관한 **타 패널 동시 작업분**이며(후속 미니맥스 catalog 건) 수정하지 않고 보고만 한다.
- 원격 CI 미실행. 커밋·push·PR 없음.
