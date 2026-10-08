# 세션 회고와 인수인계 (2026-10-08)

## 작업 목적과 운영 원칙

- 사용자 요청: 5개 기본 공급자 CLI, pnpm, SemVer/milestone, PR·보호·이슈 종료,
  워커 안정화·토큰 절약, 문서 CI 제외, Wiki, README 이미지와 pretty CLI.
- 규칙은 AGENTS.md, 실행·검증은 development.md, Git은 github.md를 먼저 읽는다.
- main 직접 push 금지. dev → main PR, merge commit, dev 유지.
- 완료 issue는 close하고 PR에는 `Closes #번호`를 넣는다. memo는 수정하지 않는다.
- 태그·Release는 검증 SHA로 이후 관리한다. 0.1.0은 발행 완료([Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0), target `6a6802a`).

## 회고

- 사용자는 분담을 반복 요청했다. 기존 워커에 파일 소유권을 지정하고 root는
  통합·검토·Git을 맡는다. 이미 배정한 구현을 root가 대신 수정하지 않는다.
- 같은 워커에 여러 지시를 연속으로 큐에 쌓으면 반영 시점이 불명확해진다.
  한 검증 단위의 변경 요청을 묶고, 완료 보고 후 다음 단위를 전달한다.
- 워커 컨텍스트를 무한히 늘리지 않는다. 작업 파일·계약·검증·남은 항목만
  구조화해 전달하고 새 세션으로 교체한다. 반복 전체 로그 읽기를 피한다.
- 공식 help와 실제 API 계약을 먼저 확인한다. 인증·usage CLI 명령 존재와
  서버에서 안정적으로 수집 가능한 응답 계약은 구분한다.
- Claude OAuth GET과 CLI auth/login·갱신은 별개다. 자동 수집은 읽기 전용이며
  429를 격리한다. 현재 backoff·Retry-After·CLI 캐시를 구현했다고 주장하지 않는다.
- 출력 라이브러리는 UI 계층에 정식 typed import로 둔다. 동적 require로
  아키텍처 검사를 피해 가지 않는다. domain/app 경계는 계속 검증한다.
- watch 테스트는 옵션 파싱뿐 아니라 실제 출력·취소·구독 해제를 확인한다.
- 보고서 감사는 자기신고 검사다. 실제 소유권 확인은 Git diff/status와 대조한다.
- 문서만 변경하면 CI fast-pass, 코드·스킬 변경이면 전체 검사다. 필수 `ci`는 유지한다.
- 버전 변경은 JSON 최상위 version만 갱신한다. 중첩 version 보존과 잘못된
  manifest·Unicode 숫자·dry-run 무변경을 회귀 검증한다.
- 이미지 API의 REST 열거형은 SDK 예제와 다를 수 있다. 공식 discovery로 확인한다.
  재생성 기록은 readme-image.md에 있으며 키·응답 원문은 저장하지 않는다.
- 재사용 절차는 `.agents/skills/agent-coordination/`, 레포 결정은 docs에 둔다.

## 산출물과 사용법

```bash
pnpm --silent run dev once --pretty
pnpm --silent run dev watch --pretty
python3 scripts/version.py --bump patch
python3 scripts/validate-repo.py
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 .agents/skills/agent-coordination/scripts/test_coordination.py
pnpm run check
```

- 프로젝트 로컬 dependencies: cli-table3, picocolors. 전역 설치하지 않았다.
- README 이미지: assets/yoroi-haunted-armor.jpg, Nano Banana 2.1, 2752×1536.
- Wiki 원본: wiki-pages/. 기존 Home 문구를 보존한다. 게시 대상은 Yoroi Wiki다.
- 버전 원본 package.json=0.1.0, milestone 0.1.0=closed(31 closed, open 0),
  milestone 0.1.1=#13–#17·#29(open),
  milestone 0.2.0=#30–#55(웹·SQLite 계획, 설계만). 열린 조사 이슈는 issue-status.md를 본다.

## 게시 상태

- PR #28 병합: `48bdd8e`.
- [PR #62](https://github.com/qus0in/yoroi/pull/62) 병합: `1b3b027`.
  [pull_request CI](https://github.com/qus0in/yoroi/actions/runs/37720540457) 성공.
- 검증: TS 136개, BDD 25시나리오·144step, Python 19개, 협업 스크립트·레포 검사 통과.
- [문서 PR #63](https://github.com/qus0in/yoroi/pull/63)의 최초 head `5b5366e`에서
  [CI](https://github.com/qus0in/yoroi/actions/runs/37721012020)가 fast-pass 성공했다.
  실제 install·app check는 skipped이며 필수 `ci`는 success다.
- PR #62의 `Closes`로 #25·#57·#59·#60·#61을 종료했다.
- [PR #63](https://github.com/qus0in/yoroi/pull/63) 병합: `6a6802a`(head `e6ffd2e`).
  [PR CI](https://github.com/qus0in/yoroi/actions/runs/37725084420) success
  (main 트리 동일, ci.yml main push 트리거 없음).
- [v0.1.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행 후 0.1.0 milestone close(31 closed, open 0).
- Wiki 원격 master `a181ccb` 게시, 새 clone 6페이지 동일 확인. #58·#56 close.
- 0.2.0 준비 설계는 로컬 `next-0.2.0` worktree의 `docs/v0.2.0/`에 있고 아직 커밋 전.
- 남은 조사: #13–#17·#29(0.1.1). 0.2.0 웹·SQLite #30–55는 설계 단계다.
- Wiki 최종 게시 증거는 [#58](https://github.com/qus0in/yoroi/issues/58),
  전체 마무리·문서 CI 검증은 [#56](https://github.com/qus0in/yoroi/issues/56)에서 확인한다(둘 다 closed).
- 다음 에이전트는 위 이슈의 최신 상태, `git status`, 열린 PR과 보호 체크를 먼저 확인한다.
  완료된 작업을 다시 구현하거나 불필요한 실계정 조회를 반복하지 않는다.
