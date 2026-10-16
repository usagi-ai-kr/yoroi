# 1.0.3 PR #170 머지·main CI 기록 (w1, `yoroi-103-merge-main-ci-w1`, 2026-10-16)

- 범위: PR #170 **머지 실행 + main workflow_dispatch CI 확인**까지. tag/Release/global/레터 없음, dev 브랜치 삭제 없음, 로컬 source 변경 없음.

## 사전 확인 (merge 직전, 06:24:34Z)

- PR #170: head `aba39d9…`·OPEN·not draft·mergeable MERGEABLE·mergeStateStatus **CLEAN**, checks 2/2 SUCCESS(run 38860580331 pull_request·38860360681 push).
- 독립 w3 보고(`/tmp/yoroi-103-pr-ci-w3-report.json`)와 일치(PR 생성 ready, 11파일, CI 2/2 PASS). 사용자 commit·Release·letter 승인+기존 merge 위임 범위로 **재질문 없음**.

## 머지 (06:24:45Z)

- `gh pr merge 170 --merge`(브랜치 삭제·squash 없음) → **merge SHA `ea381c61b794390c43ac85cc2b515f0022c1af2a`**, PR state MERGED(`https://github.com/qus0in/yoroi/pull/170`).
- 원격: main `ea381c61…`·dev `aba39d9…`(삭제 안 함)·tag `v1.0.2`(adea4d33) **불변**. main 직접 push 없음.

## main CI (workflow_dispatch)

- `gh workflow run ci.yml --ref main` → run **`38861070165`**, event workflow_dispatch, **headSha `ea381c61…`(merge SHA와 정확 일치)**, https://github.com/qus0in/yoroi/actions/runs/38861070165.
- bounded 5분 watch(내장 폴링 + 30×10s 상한 루프, `timeout` 부재로 대체): **completed / success** (poll 8 ≈ 80초). 조건(실패·running 시 Release 금지) 불필요 — release 진행 가능 상태.

## 보존

- 로컬 ROOT: checkout/reset 없음, HEAD `aba39d9` 유지, dirty3(score `0f766be8…`·four-source `14b2846e…`·orchestration `f6ff5155…`)+미추적 문서 보존, 소스 변경 없음. 이 단위는 원격 머지·CI 실행·조회만.

## 후속

- **main CI success 확인 후에만** tag/Release `v1.0.3` → global(`/tmp/yoroi-103-update-global.sh`) → 레터(별도 패킷). 실패/running이면 Release 진행 금지, 그대로 보고. 보고 후 메신저 지시 대기.
