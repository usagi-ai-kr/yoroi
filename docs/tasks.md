# 로컬 작업 기록 (현재 운영 현황)

- 원격이 없거나 외부 기록이 허가되지 않은 작업은 여기에 기록한다.
- 과거 상세 기록(2026-10-07 ~ 10-08 초기 구성·PR #28)은 [tasks-archive.md](tasks-archive.md)에 보관한다.
- main에 직접 push하지 않는다. 모든 변경은 dev → main PR로 병합한다.

## 현재 상태 (2026-10-08)

- 병합 완료: PR #28(`48bdd8e`), PR #62(`1b3b027`, head `b09ac71`),
  PR #63(`6a6802a`, head `e6ffd2e`, PR CI `37725084420` success).
- v0.1.0 [tag·Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행(target `6a6802a`).
- Wiki 원격 master `a181ccb` 게시, 새 clone 6페이지 동일 확인. #58·#56 close.
- 0.1.0 milestone close(31 closed, open 0). 0.1.1 milestone close(#15–#17 closed).
  잔존 #13·#14·#29는 새 milestone 0.1.2로 이동(사용자 결정 2026-10-08).
- PR #62 검증: PR CI `37720540457` success, push CI `37720536646` success.
- 구현·문서 자동화 완료(main 반영): CI 분류기와 docs-only fast pass, `test_*.py` unittest, agent-coordination 스킬, 버전 스크립트, pretty CLI(`--pretty`), README 중세 유럽 기사 갑옷 이미지.
- 검증 수치(루트 보고): TS 136 tests, BDD 25 시나리오/144 step, Python 19 tests, 스킬 테스트 PASS.
- 닫힌 이슈: #1–#25 중 완료 기준을 충족한 항목, #3(red→green 실측), #22, #25, #57, #59, #60, #61. #13–#17·#29는 0.1.1로 이동했고 계약 대조 후 #15–#17 closed.
- 버전: `package.json` `0.1.2`(사용자 결정 2026-10-08). v0.1.0·v0.1.1·v0.1.2 tag·Release 발행 완료.
- 0.1.2 발행 완료: PR #66 머지 커밋 `4dfd4d7`(2026-10-08T10:35:35Z, .env 병합 로드 `68bce2f` 포함),
  머지 후 workflow_dispatch CI run `37764517117` success, tag `v0.1.2` → `4dfd4d7`,
  [v0.1.2 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.2) 발행, milestone #4 close(open 3: #13·#14·#29 유지).
- PR #67 병합 완료: merge commit `62ef080`(2026-10-08T13:16:52Z), head `3dadf92`.
  PR CI `37780797515` success, main workflow_dispatch CI `37783139920` success.
  포함 커밋: `ff3371c`(서브커맨드 도움말 `once/watch --help`·`-h`), `3dadf92`(문서 정리·`global-install.md` 분리).
- 현재 상태 요약: **0.1.x 마무리 완료·0.2.0 보류**(milestone #2·#30–#55 open 유지). 미완 #13·#14·#29 open 유지.
- 다음 후보: PR #67 변경을 담을 0.1.3 tag·Release 필요 여부는 사용자 결정(주의: opencode worker는 무료 모델 소진 시 오래된 패킷을 재실행할 수 있어 주의).
- 0.1.1 발행 완료: PR #65 머지 커밋 `7470250`, 머지 후 workflow_dispatch CI run `37735089637` success,
  [v0.1.1 tag·Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.1) 발행, milestone #3 close(open 3: #13·#14·#29 유지).
- PR #63(dev): CLI 숫자 올림·reset_in 표시, 오케스트레이터 분담·graceful-stop 스킬. 병합 `6a6802a` 완료.

## 남은 작업

- 0.1.x 마무리 완료: 서브커맨드 도움말 및 문서 분리 반영(PR #67). 미완 계약 #13·#14·#29 open 유지.
- 0.1.3 tag·Release 발행 여부는 사용자 결정.
- 0.2.0 보류: 계획 문서 [v0.2.0-plan.md](v0.2.0-plan.md). 설계 초안 14건은 `docs/v0.2.0/`으로 dev 이관 완료. milestone #2·#30–#55 open 유지.
- CLI 전역화(`install:global`·.env 복사·cwd+설치 사본 병합 로드): 구현·문서([global-install.md](global-install.md))·실측 완료.
- 그 외 추가 개발은 계획하지 않는다.

## 회고 (2026-10-08)

- 중단 요청 뒤 worker·후속 단계가 자동 재개되는 문제가 있었다 → `graceful-stop` 스킬 추가(재개 금지 체크포인트).
- root가 구현을 직접 맡아 부담이 커졌다 → root는 오케스트레이터, 구현·조사·검증은 패킷 분담([orchestration.md](orchestration.md)).
- opencode worker는 무료 모델 소진 시 오래된 패킷을 재실행할 수 있어 주의 필요.

## 소유표

| 영역 | 소유 | 상태 |
| --- | --- | --- |
| workflow `ci.yml`, agent-coordination 스킬, CI unittest | p2 | 병합 완료(#62) |
| pretty CLI | p2 | 병합 완료(#62), #59 closed |
| CI classifier, `validate-repo.py --ci`, `development.md` CI 문장 | p3 | 병합 완료(#62) |
| 버전 스크립트 `scripts/version.py`, `docs/versioning.md` | p3 | 병합 완료(#62), #61 closed |
| Wiki 소스·게시 | p4 | 게시 완료. #58 closed |
| issue·docs 운영 현황, 독립 검토 | p5 | 본 문서 포함. 독립 검토 완료 |
| README 이미지, 통합, 커밋·push·PR·merge | root | 병합 완료(#62). 다음 docs-only PR 담당 |

## CI 정책

- CI job은 항상 실행된다. 변경이 문서뿐(`docs/**`, 루트 README·AGENTS·CLAUDE)이면 앱 install·check를 생략하는 fast pass로 필수 체크 `ci`를 통과시킨다.
- 코드·workflow·스킬 변경은 `validate-repo.py --ci`, 스킬·회귀 테스트, frozen install, 전체 check를 실행한다.
- 필수 체크 `ci`는 docs-only에서도 계속 요구하며 pending으로 남지 않아야 한다.
- 운영 skill(`.agents/skills/**`)은 제외 대상이 아니다. 스킬 변경은 full 경로다.

## 이슈·마일스톤 매핑

- `0.1.0`: #1–#12·#18–#28, #56–#61. 릴리스 버전 0.1.0(v0.1.0 tag·Release 발행 완료).
- `0.1.1`: #13–#17·#29. 0.1.0에서 이동(사용자 결정). 계약 대조로 #15·#16·#17 closed, milestone #3 closed, v0.1.1 발행 완료.
  - 회고: `report_audit.py`는 glob 소유 패턴을 펼치지 않아 오탐 FAIL을 낸다. root가 `git status`로 대조한다.
- `0.1.2`: #13·#14·#29. 0.1.1에서 이동(사용자 결정 2026-10-08, 남은 계약 확인). milestone #4 closed, v0.1.2 발행 완료, 3건은 open 유지.
- `0.2.0`: #30–#55. 보류: 0.2.0 보류(사용자 결정 2026-10-08, 이유: 0.1.x 마무리 우선, milestone #2·#30–#55 open 유지). 계획 문서 v0.2.0-plan.md.
- 상세: [issue-status.md](issue-status.md).
