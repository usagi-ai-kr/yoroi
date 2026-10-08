# 협업 분담·중단 (레포 전용 값)

일반 절차는 스킬을 따른다. 여기에는 이 레포의 pane·경로·역할 값만 둔다.

- 분담·패킷·감사: [agent-coordination](../.agents/skills/agent-coordination/SKILL.md)
- 중단·체크포인트·재개: [graceful-stop](../.agents/skills/graceful-stop/SKILL.md)

## Herdr pane 역할

워크스페이스 `wX`의 pane 번호 기준이다. root는 별도 pane에서 오케스트레이터로 동작한다.

| pane | 담당 | 상태 (2026-10-08) |
| --- | --- | --- |
| `wX:p1` (claude) | root 오케스트레이터 | 사용 중 |
| `wX:p2` (agy) | CLI, 스킬, workflow | 사용 가능 |
| `wX:p3` (claude) | CI, 버전, 문서·Wiki 운영, 검증·측정 | 사용 가능 |
| `wX:p4`·`wX:p5` | 없음 | 구성에서 제거됨 |

- worker 권한 프롬프트는 root가 승인하지 않고 다른 pane에 재배정한다.
- 같은 파일을 두 pane에 동시에 배정하지 않는다. 현재 소유표는 [tasks.md](tasks.md)에 둔다.
- 이름: 에이전트 이름은 하네스 이름 그대로다(p1·p3 `claude`, p2 `agy`). pane 라벨은 지정하지 않는다.
- pane의 에이전트·모델은 사용자가 정한다. root는 `herdr agent list`와 화면의 모델 표시로 현재 상태를
  확인한 뒤 그 안에서 배정하고, `/exit`·`herdr agent start`·모델 선택·권한 승인은 요청 시에만 한다.
- 2026-10-08 사고: root가 p3·p4·p5를 임의로 종료하고 DeepSeek V4 Pro로 재시작했고, p4에서는 확인 없는
  키 입력으로 모델이 바뀌었다. 이후 구성은 사용자가 정했고 현재 값은 위 표다.

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
