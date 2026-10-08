# 협업 분담·중단 (레포 전용 값)

일반 절차는 스킬을 따른다. 여기에는 이 레포의 pane·경로·역할 값만 둔다.

- 분담·패킷·감사: [agent-coordination](../.agents/skills/agent-coordination/SKILL.md)
- 중단·체크포인트·재개: [graceful-stop](../.agents/skills/graceful-stop/SKILL.md)

## Herdr pane 역할

워크스페이스 `wX`의 pane 번호 기준이다. root는 별도 pane에서 오케스트레이터로 동작한다.

| pane | 담당 | 상태 (2026-10-08) |
| --- | --- | --- |
| `wX:p2` (AGY) | CLI, 스킬, workflow | 사용 가능 |
| `wX:p3` | CI, 버전 | 사용 가능 |
| `wX:p4` | Wiki | root가 Esc로 중지 |
| `wX:p5` | 이슈, 문서 운영 | root가 Esc로 중지 |

- 중지한 p4·p5는 상태(마지막 보고·변경 파일)를 확인한 뒤 root의 명시 지시(새 패킷)로만 재개한다.
- 같은 파일을 두 pane에 동시에 배정하지 않는다. 현재 소유표는 [tasks.md](tasks.md)에 둔다.

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
| 통합 충돌 해소, 한두 줄 정정 | Wiki 소스·게시 준비(p4) |
| 커밋·push·PR·merge·이슈 close | 문서·회고 초안, 이슈 현황 정리(p5) |
| AGENTS.md 규칙 반영(사용자 요청 시) | `pnpm run check`, `validate-repo.py` 실행·보고 |
