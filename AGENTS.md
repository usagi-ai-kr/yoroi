# 에이전트 작업 규칙

- 이 문서는 사용자가 규칙 변경을 요청했을 때만 수정한다. 단, 하네스 문제 해결을 위한 규칙 개선은 사용자의 상시 요청 및 승인 범위 내에서 수행한다.
- README.md는 사용자가 수정을 요청했을 때만 변경한다.
- 직접 작성하는 코드·문서·설정은 파일당 100줄 이하로 유지한다.
  생성 파일·의존성 잠금 파일·바이너리는 제외하며 예외는 docs/development.md에 기록한다.
- 작업을 5분 이내에 검증 가능한 단위로 나누고 진척·남은 작업을 짧게 보고한다.
  긴 작업은 단위별로 이어서 수행하고, 위임은 사용자 요청이나 적용되는 지침에 따른다.
- 메신저는 사용자 요청·컨텍스트와 필요한 사용자 조치를 전달하고, 사용량 초과 시 역할 재배분·인계를 맡는다.
  질문 보완 외 업무는 오케스트레이터에게 위임한다. 현재 구성과 역할은 docs/orchestration.md를 따른다.
- 오케스트레이터는 메신저의 작업을 docs 기반 패킷으로 워커에게 분배하고, 느린 원인을 해결한다.
  긴 테스트·빌드는 백그라운드로 돌리고, 패킷 왕복보다 빠른 조회·git/gh 단일 조작은 직접 한다. 작업을 쥐고 있지 않고,
  메신저 요청 누락 방지를 위한 백그라운드·일부 서브에이전트를 허용한다.
  리뷰어의 PR 발행을 백그라운드로 감지해 작업 종료를 판정한다.
- 워커는 진행 중 주요 내용을 docs에 보고하고 최종 의견·분석은 issue에 남긴다.
  복잡한 판단은 리뷰어에게 맡기고 단위테스트·요청/문서 일치도를 먼저 확인한다.
- 리뷰어는 결과를 평가·판단하고 작은 문제를 직접 개선하거나 오케스트레이터에게 재분배를 요청한다.
  큰 문제가 없으면 dev → main PR을 발행한다. CI·리뷰 통과 PR은 머지 후 사후 보고한다(2026-10-15 위임).
- 워커의 모델·세션은 사용자가 정한다. 실행 중인 워커와 모델 안에서 분담한다.
  종료·재시작·모델 변경은 사용자 명시 요청 시에만 한다. 권한·요금제·환경변수·비밀값·인프라·결정 등
  사용자 조치가 필요한 원인은 메신저를 통해 전달하며 오케스트레이터가 임의 승인하지 않는다.
- 중단 요청을 받으면 새 작업을 시작하지 않고 `graceful-stop` 스킬로 멈춘다.
  "이어하기"는 인수인계의 후속 단계가 아니라 현재 요청 범위만 수행한다.
- 기존 사용자 변경을 보존하고 요청 범위의 구현과 검증을 끝까지 수행한다.
- 리뷰·검증을 통과한 작업 단위는 요청 없이 커밋한다(2026-10-15 지시). 사용자 변경은 섞지 않는다.
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
- 하네스(스킬·규칙·스크립트·문서 전반)에서 대기·완료판정·협업·검증 등 관측된 문제가 발생하면 별도 지시 없이 `harness-improvement` 스킬로 즉시 진단하고 최소 재발방지 개선을 적용한다. 메타 작업 무한 루프는 금지한다.
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
- 하네스 개선: [docs/insights/harness-improvement-policy.md](docs/insights/harness-improvement-policy.md), `harness-improvement` 스킬

스킬 원본은 `.agents/skills/`다. 작업에 맞는 아래 파일을 읽고 적용한다.

- [github-workflow](.agents/skills/github-workflow/SKILL.md)
- [skill-authoring](.agents/skills/skill-authoring/SKILL.md)
- [semver-milestones](.agents/skills/semver-milestones/SKILL.md)
- [agent-coordination](.agents/skills/agent-coordination/SKILL.md)
- [graceful-stop](.agents/skills/graceful-stop/SKILL.md)
- [global-cli-update](.agents/skills/global-cli-update/SKILL.md)
- [coordination-rules](.agents/skills/coordination-rules/SKILL.md)
- [harness-improvement](.agents/skills/harness-improvement/SKILL.md)
