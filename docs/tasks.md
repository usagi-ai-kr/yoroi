# 로컬 작업 기록 (현재 운영 현황)

- 원격이 없거나 외부 기록이 허가되지 않은 작업은 여기에 기록한다.
- 과거 상세 기록(2026-10-07 ~ 10-08 초기 구성·PR #28)은 [tasks-archive.md](tasks-archive.md)에 보관한다.
- main에 직접 push하지 않는다. 모든 변경은 dev → main PR로 병합한다.

## 현재 상태 (2026-10-08)

- 병합 완료: PR #28(`48bdd8e`), PR #62(`1b3b027`, head `b09ac71`).
- PR #62 검증: PR CI `37720540457` success, push CI `37720536646` success.
- 구현·문서 자동화 완료(main 반영): CI 분류기와 docs-only fast pass, `test_*.py` unittest, agent-coordination 스킬, 버전 스크립트, pretty CLI(`--pretty`), README 중세 유럽 기사 갑옷 이미지.
- 검증 수치(루트 보고): TS 136 tests, BDD 25 시나리오/144 step, Python 19 tests, 스킬 테스트 PASS.
- 닫힌 이슈: #1–#25 중 완료 기준을 충족한 항목, #3(red→green 실측), #22, #25, #57, #59, #60, #61. #13–#17·#29는 0.1.1로 이동하고 open 유지.
- 버전: `package.json` 0.1.0 유지. tag·GitHub Release 미발행. PR #63 병합·main CI 통과 시 v0.1.0 tag·Release 발행과 0.1.0 milestone close 예정(사용자 결정).
- PR #63(dev, 커밋 `62f55fd`·`51bfac8`): CLI 숫자 올림·reset_in 표시, 오케스트레이터 분담·graceful-stop 스킬. 병합 전.

## 남은 작업

- PR #63 병합·main CI 통과 후 v0.1.0 tag·Release를 발행하고 0.1.0 milestone을 close한다.
- Wiki(#58)는 아직 게시 전이다. 다음 순서로 진행한다.
  1. 원격 docs-only CI의 첫 pass를 확인한다.
  2. main의 #62 기준 Wiki 소스로 Wiki를 게시한다.
  3. 실제 게시를 확인한 뒤 같은 문서 PR에 완료 상태를 갱신하는 두 번째 커밋을 넣는다.
  4. 그때 #58과 #56을 직접 close한다.
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
| Wiki 소스·게시 | p4 | 게시 전. #58 |
| issue·docs 운영 현황, 독립 검토 | p5 | 본 문서 포함. 독립 검토 완료 |
| README 이미지, 통합, 커밋·push·PR·merge | root | 병합 완료(#62). 다음 docs-only PR 담당 |

## CI 정책

- CI job은 항상 실행된다. 변경이 문서뿐(`docs/**`, 루트 README·AGENTS·CLAUDE)이면 앱 install·check를 생략하는 fast pass로 필수 체크 `ci`를 통과시킨다.
- 코드·workflow·스킬 변경은 `validate-repo.py --ci`, 스킬·회귀 테스트, frozen install, 전체 check를 실행한다.
- 필수 체크 `ci`는 docs-only에서도 계속 요구하며 pending으로 남지 않아야 한다.
- 운영 skill(`.agents/skills/**`)은 제외 대상이 아니다. 스킬 변경은 full 경로다.

## 이슈·마일스톤 매핑

- `0.1.0`: #1–#12·#18–#28, #56–#61. 제품 버전은 0.1.0을 유지한다.
- `0.1.1`: #13–#17·#29. 0.1.0에서 이동(사용자 결정).
- `0.2.0`: #30–#55. 아직 구현하지 않았다. 이번 작업 범위가 아니다.
- 상세: [issue-status.md](issue-status.md).
