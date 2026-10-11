# 에이전트 작업 규칙

- 이 문서는 사용자가 규칙 변경을 요청했을 때만 수정한다.
- README.md는 사용자가 수정을 요청했을 때만 변경한다.
- 직접 작성하는 코드·문서·설정은 파일당 100줄 이하로 유지한다.
  생성 파일·의존성 잠금 파일·바이너리는 제외하며 예외는 docs/development.md에 기록한다.
- 작업을 10분 이내에 검증 가능한 단위로 나누고 진척·남은 작업을 짧게 보고한다.
  긴 작업은 단위별로 이어서 수행하고, 위임은 사용자 요청이나 적용되는 지침에 따른다.
- 하위 worker를 쓰는 세션의 root는 오케스트레이터다. 구현·조사·검증 실행은 패킷으로 분담하고
  root는 범위 결정·패킷·감사·통합·외부 기록만 맡는다. 절차는 `agent-coordination` 스킬을 따른다.
- worker의 모델·세션은 사용자가 정한다. root는 이미 실행 중인 worker와 그 모델 안에서만 분담하고,
  worker 종료·재시작·모델 변경·권한 승인은 사용자가 명시적으로 요청할 때만 한다.
- 중단 요청을 받으면 새 작업을 시작하지 않고 `graceful-stop` 스킬로 멈춘다.
  "이어하기"는 인수인계의 후속 단계가 아니라 현재 요청 범위만 수행한다.
- 기존 사용자 변경을 보존하고 요청 범위의 구현과 검증을 끝까지 수행한다.
- 커밋을 제안하거나 자동으로 만들지 않는다. 사용자 요청 시에만 커밋한다.
- push·배포 요청은 필요한 회고와 커밋을 포함한다. 대상·범위는 요청에서 확인한다.
- main에 직접 push하지 않는다. 초기 원격 연결 이후 dev → main PR을 사용한다.
- 버전이 바뀐 변경이 main에 머지되면 이 Mac의 전역 CLI를 `global-cli-update` 스킬과
  docs/global-install.md 절차로 갱신하고 버전 일치를 확인한다. tag·Release·publish는
  main CI 통과를 확인한 뒤 승인 없이 자동 발행하고 URL·커밋 SHA를 사후 보고한다(2026-10-11 사용자 지시).
- GitHub 이슈·댓글·PR·레포 설정 변경은 사용자 요청으로 허가된 범위에서 실행한다.
  원격이 없거나 외부 기록이 허가되지 않은 경우 docs/tasks.md에 기록하고 작업을 계속한다.
- memo 이슈는 사람 전용이다. 읽고 참고할 수 있지만 수정·생성·라벨 부착·close하지 않는다.
- 처리된 issue는 반드시 close한다. 완료 기준을 충족하면 PR 본문에 `Closes #번호`를 넣어 자동 종료하거나 PR 밖에서 직접 close한다.
  미완료 사유가 있으면 open으로 두고 사유를 1–2줄로 남긴다. PR 머지 뒤에야 끝나는 작업(예: 외부 게시)은 PR Closes에 넣지 않는다.
- 작업 후 회고한다. 반복할 가치가 있는 절차는 .agents/skills/에,
  레포 전용 결정·검증 결과·트러블슈팅은 docs/에 기록한다. 새로운 배움이 없으면 중복 기록하지 않는다.
- 스킬은 다른 레포에서도 재사용할 수 있도록 작성하고 레포 값은 docs/에서 확인한다.
- 연결된 레포의 변경도 작업 흐름에 포함하되 변경 주체·근거·검증 여부를 구분한다.
- 시크릿·토큰·개인 사용량 원본은 커밋하거나 이슈·로그에 노출하지 않는다.
- 완료 전 `python3 scripts/validate-repo.py`와 변경에 맞는 검증을 실행한다.
  앱 빌드·테스트 명령은 docs/development.md를 따른다.

## 필요한 문서와 스킬

- 개발·검증: [docs/development.md](docs/development.md)
- Git/GitHub 운영: [docs/github.md](docs/github.md), `github-workflow` 스킬
- 스킬 작성·회고: [docs/skills.md](docs/skills.md), `skill-authoring` 스킬
- 목표·버전 관리: [docs/roadmap.md](docs/roadmap.md), `semver-milestones` 스킬
- 로컬 작업 기록: [docs/tasks.md](docs/tasks.md)
- 협업 분담·중단: [docs/orchestration.md](docs/orchestration.md), `agent-coordination`·`graceful-stop` 스킬

스킬 원본은 `.agents/skills/`다. 작업에 맞는 아래 파일을 읽고 적용한다.

- [github-workflow](.agents/skills/github-workflow/SKILL.md)
- [skill-authoring](.agents/skills/skill-authoring/SKILL.md)
- [semver-milestones](.agents/skills/semver-milestones/SKILL.md)
- [agent-coordination](.agents/skills/agent-coordination/SKILL.md)
- [graceful-stop](.agents/skills/graceful-stop/SKILL.md)
- [global-cli-update](.agents/skills/global-cli-update/SKILL.md)
