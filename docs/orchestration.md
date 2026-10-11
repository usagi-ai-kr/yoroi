# 협업 분담·중단 (레포 전용 값)

일반 절차는 스킬을 따른다. 여기에는 이 레포의 pane·경로·역할 값만 둔다.

- 분담·패킷·감사: [agent-coordination](../.agents/skills/agent-coordination/SKILL.md)
- 중단·체크포인트·재개: [graceful-stop](../.agents/skills/graceful-stop/SKILL.md)

## Herdr pane 역할

워크스페이스 `w12`의 pane 번호 기준이다(사용자 구성, 2026-10-10). root는 p1에서 오케스트레이터로 동작한다.

| pane | 모델 (사용자 지정) | 역할 | 비고 |
| --- | --- | --- | --- |
| `w12:p1` | Claude Opus 5.5 | root 오케스트레이터 | 범위·패킷·감사·통합 |
| `w12:p2` | Claude Sonnet 5.5 | worker | 구현·검증 |
| `w12:p3` | Codex GPT-6.1-Sol | worker | 구현·조사 |
| `w12:p4` | Codex GPT-6-Luna | worker | 구현·조사 |
| `w12:p5` | OpenCode Zen Space Bunny Free | worker | 한도 감시 대상 |
| `w12:p6` | OpenCode Go LongCat 2.5 Preview Free | worker | 구현·검증 |
| `w12:p7` | OpenCode Go Step 5 Preview Free | worker | 구현·검증 |
| `w12:p8` | Ollama Cloud DeepSeek V4.1 Flash | worker | 문서·검증 |

- **p5 한도 감시(임시, #72 훅 도입 전)**: 패킷 전송 전과 작업 진행 중 visible 화면에서
  `Free usage exceeded`·재시도 문구를 확인하고, 보이면 p5를 가용 worker에서 제외한다.
  모델·pane은 바꾸지 않는다(사용자 결정).
- OpenCode worker(p5–p7)는 `/tmp` 접근 권한 프롬프트가 뜰 수 있고 승인은 사용자가 한다.
  root는 대신 승인하지 않고 다른 가용 pane에 재배정한다.
- 같은 파일을 두 pane에 동시에 배정하지 않는다. 현재 소유표는 [tasks.md](tasks.md)에 둔다.
- pane의 에이전트·모델은 사용자가 정한다. root는 `herdr agent list`와 화면의 모델 표시로 현재 상태를
  배정 직전에 확인한 뒤 그 안에서 배정하고, `/exit`·`herdr agent start`·모델 선택·권한 승인은 요청 시에만 한다.
- 2026-10-08 사고: root가 p3·p4·p5를 임의로 종료하고 DeepSeek V4 Pro로 재시작했고, p4에서는 확인 없는
  키 입력으로 모델이 바뀌었다. 이후 구성은 사용자가 정했고 현재 값은 위 표(2026-10-10 갱신)다.

## root 역할 (2026-10-10 사용자 지시, Hermes 전달)

- root의 중심 업무는 worker 결과 리뷰, 작업 분배, 회고와 배운 점 전파다. 직접 구현·조사로 응답을
  오래 막지 않고 백그라운드 실행을 활용한다.
- 계획·마일스톤·우선순위·설계 판단은 root 혼자 확정하지 않는다. 판단 가능한 worker(Claude Sonnet,
  Codex Sol/Luna 등)에 같은 질문을 독립 분배해 비교·종합하고, 구현 worker와 검토 worker를 분리한다.
- Hermes는 사용자 원문 전달과 진행·결과 전달만 하는 메신저다.
- agy가 두 pane이면 agy1을 우선 쓰고, agy1 패킷에는 나눌 수 있는 범위를 서브에이전트로 병렬 처리하라는
  권장 문구를 넣는다. agy2는 병렬 분할·독립 확인용이며 같은 요청을 중복 배정하지 않는다(2026-10-11 사용자 지시).

## 배운 점 (2026-10-10)

- 작업 중 pane은 `herdr agent read --source visible`만 통한다(recent 읽기는 실패). 전송 전·진행 중 확인도 visible을 쓴다.
- zsh에서 `set -- $x` 반복 전송은 단어 분리가 안 돼 빈 프롬프트가 된다. 전송 전에 인자 분리·내용을 검증한다.
- 루프 감시는 스킬 스크립트로 일반화했다([watch_workers.sh](../.agents/skills/agent-coordination/scripts/watch_workers.sh)).
  이 레포에서 쓰는 호출 예시는 다음과 같다(pane·보고서 경로가 레포 고유 값이므로 여기에 둔다).

  ```bash
  bash .agents/skills/agent-coordination/scripts/watch_workers.sh \
    --reports /tmp/yoroi-<task>-report.json [...] --panes w12:p5 w12:p6 --interval 20 --max-polls 120
  ```

  종료 조건은 새 보고서 생성, `blocked` pane, 무료 모델 한도 문구다. 한도 대상은 p5다.

## 패킷·보고서 경로

| 항목 | 경로 |
| --- | --- |
| 작업 패킷 | `/tmp/<task_id>-packet.json` |
| worker 보고서 | `/tmp/<task_id>-report.json` (패킷 `report_path`) |

- `task_id`는 `yoroi-` 접두어를 쓴다(예: `yoroi-orch-docs`).
- `/tmp` 파일은 임시다. 커밋하지 않으며 남길 결론은 docs/에 옮긴다.

## 중단 체크포인트

- 중단 시 임시 체크포인트는 `/tmp/yoroi-handoff.md`에 만든다(`stop_checkpoint.py create`).
  기존 파일이 있으면 덮어쓰지 않고 새 이름을 쓰거나 사용자 확인 후 `--force`를 쓴다.
- [session-handoff.md](session-handoff.md)는 커밋되는 세션 회고·인수인계다.
  임시 체크포인트 중 다음 세션에 필요한 결정·남은 작업만 root가 옮긴다.
- 체크포인트의 `재개 금지`는 사용자가 명시적으로 재개를 요청할 때까지 유효하다.

## root 직접 vs 분담 (이 레포 기준)

| root가 직접 | 패킷으로 분담 |
| --- | --- |
| 사용자 범위 확인, 패킷 발행, pane 배정 | `src/`·`tests/` 구현과 테스트 |
| 보고서 감사, `git diff --stat` 대조 | 스킬·스크립트 수정(p2), CI·버전(p3) |
| 통합 충돌 해소, 한두 줄 정정 | Wiki 소스·게시 준비(p3) |
| 커밋·push·PR·merge·이슈 close | 문서·회고 초안, 이슈 현황 정리(p3) |
| AGENTS.md 규칙 반영(사용자 요청 시) | `pnpm run check`, `validate-repo.py` 실행·보고 |
