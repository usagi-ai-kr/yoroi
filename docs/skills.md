# 스킬 운영

- 원본: `.agents/skills/<name>/SKILL.md`.
- `CLAUDE.md` → `AGENTS.md`, `.claude/skills` → `../.agents/skills` 상대 링크로 공유한다.
- Codex의 저장소 스킬 탐색 경로를 사용한다. AGENTS.md에도 적용할 스킬 링크를 안내한다.
- 스킬은 일반 절차, 레포 경로·계정·설정·결정은 `docs/`에 기록한다.

| 스킬 | 사용 시점 |
| --- | --- |
| `skill-authoring` | 스킬 생성·수정·검증, 재사용할 회고 반영 |
| `github-workflow` | 계획·진척·보고, 이슈·PR·라벨·레포 운영 |
| `semver-milestones` | 목표·milestone·버전 계획, 릴리스 준비 |
| `agent-coordination` | 오케스트레이터 분담, 토큰 절약·파일 소유권·작업 패킷 위임 및 감사 |
| `graceful-stop` | 작업 중단 요청, worker 일괄 중지, 재개 금지 체크포인트·재개 판단 |

```bash
python3 scripts/validate-repo.py
```

구조 검증은 지시 품질을 보장하지 않는다. 규칙·사용자 범위·권한과 충돌하지 않는지 검토한다.

## 경로 결정

qketing과 동일하게 `.agents/skills/`를 원본으로 사용한다.
2026-10-07 권한 조정 후 임시 `skills/` 경로에서 이전했다. 중복 원본은 두지 않는다.
