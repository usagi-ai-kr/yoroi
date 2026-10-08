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
- 버전: `package.json` `0.1.2`(사용자 결정 2026-10-08, 커밋 대기). v0.1.0·v0.1.1 tag·Release 발행 완료.
- 0.1.2 준비: dev → main PR 예정, tag·Release는 미발행(별도 승인). 포함 변경 `v0.1.1..origin/dev`:
  전역 설치·.env 복사, 정렬 m→w→h, agy 주간 exp, credits:purchased 숨김, under/optimal/over,
  Status 열 이동, #31 이벤트 계약 착수. milestone 0.1.2의 #13·#14·#29는 이번 PR로 닫지 않고 open 유지.
- 0.1.1 발행 완료: PR #65 머지 커밋 `7470250`, 머지 후 workflow_dispatch CI run `37735089637` success,
  [v0.1.1 tag·Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.1) 발행, milestone #3 close
  (open 3: #13·#14·#29 유지·이관 없음).
  포함 변경 `v0.1.0..7470250`: PR #64 표시 개선(Ollama activity·창 짧은 표기)과 `f8ba205` 계약 대조(#13–#17).
- PR #63(dev, 커밋 `62f55fd`·`51bfac8`): CLI 숫자 올림·reset_in 표시, 오케스트레이터 분담·graceful-stop 스킬. 병합 `6a6802a` 완료.

## 남은 작업

- 0.1.2(milestone #4): #13(429 미실측)·#14(balance fallback 미실측)·#29(Claude `/usage` 환경별 차이, hold) open.
  0.1.1에서 이동(사용자 결정 2026-10-08, 남은 계약 확인).
- 0.2.0 착수: 계획 문서 [v0.2.0-plan.md](v0.2.0-plan.md). 첫 단위 #31 이벤트 계약 타입 진행 중
  (`src/app/collection-events.ts`·`tests/collection-events.test.ts`). 다음 단위: #31 Zod → #32.
  설계 문서는 로컬 브랜치 `next-0.2.0` worktree의 `docs/v0.2.0/`에 있고 아직 커밋 전.
- CLI 전역화(`install:global`·.env 복사·cwd 우선 로드): 구현·문서·실측 완료(418812b·7c5fc18).
- 그 외 추가 개발은 계획하지 않는다.

## 회고 (2026-10-08)

- 중단 요청 뒤 worker·후속 단계가 자동 재개되는 문제가 있었다 → `graceful-stop` 스킬 추가(재개 금지 체크포인트).
- root가 구현을 직접 맡아 부담이 커졌다 → root는 오케스트레이터, 구현·조사·검증은 패킷 분담. 값은 [orchestration.md](orchestration.md).

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
- `0.1.2`: #13·#14·#29. 0.1.1에서 이동(사용자 결정 2026-10-08, 남은 계약 확인).
- `0.2.0`: #30–#55. 착수: 계획 문서 v0.2.0-plan.md, 첫 단위 #31 진행·다음 #31 Zod → #32.
- 상세: [issue-status.md](issue-status.md).
