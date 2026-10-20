# 로컬 작업 기록 (현재 운영 현황)

- 원격이 없거나 외부 기록이 허가되지 않은 작업은 여기에 기록한다.
- 0.4.0 이전 과거 상세 기록과 이전 운영 상태는 [tasks-pre040.md](tasks-pre040.md) 및 [tasks-archive.md](tasks-archive.md)에 보관한다.
- 0.13.2 정리 과정의 과거 상세 이력은 [tasks-archive-2.md](tasks-archive-2.md)에 보관한다.
- 1.0.0 이전 운영 기록(2026-10-14 현재 상태·소유표·0.1.0~0.8.x 마일스톤 매핑 등)은 [tasks-pre100.md](tasks-pre100.md)에 원문 그대로 옮겼다.
- main에 직접 push하지 않는다. 모든 변경은 dev → main PR로 병합한다.

## 현재 상태 (2026-10-15)

- [완료] 1.0.0 발행: PR #158 머지 `5111378cccf5f2436db0f1fae8c0715e76c94edb`, main CI [38744891994](https://github.com/qus0in/yoroi/actions/runs/38744891994) success, [Release v1.0.0](https://github.com/qus0in/yoroi/releases/tag/v1.0.0) publishedAt 2026-10-15T13:50:05Z, tag 동일 SHA, 전역 CLI 1.0.0(`--check` exit 0), milestone 23 closed.
- [완료] 0.13.3 병합: PR #156 → main `21405b0`. 별도 tag·Release 생략, 내용은 1.0.0에 포함.
- [완료] D(xAI 구독 사용률) #147 closed.
- [보존] 미커밋 5파일(effort 3·orchestration.md·takeover 기록)은 1.0 커밋에서 뺐고 워킹트리에 유지한다.
- [완료] 1.0.1 patch: PR #159 머지 `c7c403ee`, main CI attempt 2 success, tag `v1.0.1`·Release(동일 SHA), 전역 1.0.1, 레터 [#160](https://github.com/qus0in/yoroi/issues/160) 발행 후 #157 close.
- [완료] 1.0.2 R 선형 가성비 + 정규 순위 표시 보정(2026-10-16): **PR #169 머지**(main `adea4d33868b6b40219fdf4da06de1e0e637a2d2` = tag `v1.0.2` = Release, 06:01:24Z). dev 커밋 `44253ed`(warn·Argon·Muse 47파일) 포함. dirty5 제외·워킹트리 보존. 레터 #162 발행 후 #171(1.0.3 수정본)로 대체·close.
- [완료] 1.0.3 워커 effort 표기 정합(2026-10-16): **PR #170 머지**(main `ea381c61b794390c43ac85cc2b515f0022c1af2a` = tag `v1.0.3` = Release Latest, 06:31:13Z). dev 커밋 `aba39d9`(score 1줄+3케이스+버전+문서 11파일). main CI success·전역 1.0.3·레터 #171 발행·#162·#165 close. #164·#167도 closed. 워킹트리 원본 dirty 보존.

## 남은 작업

- [완료잔무] 1.0.3 완료 기록 중: release-status·tasks 갱신, 최종 인수 문서, 하네스 범위 기록. 다음 harness+완료문서 commit은 별도 판단.
- [검증] 하네스: coord-completion 5/5·full unit 1068·skill 자동 적용·exit 4/5/6·300초. 미래 commit·SHA 상태 선반영 없음.
- [이월] 1.1.0: 접근 effort 상한(xhigh), 워커 effort 정책 확정([roadmap.md](roadmap.md) "1.1.0 후속").
- [hold] [#29](https://github.com/qus0in/yoroi/issues/29): 0.1.2 milestone(#4)에 open·hold 유지(2026-10-10 사용자 결정).
- [미착수] PR #86 후속: 토큰 갱신 이력 끊김(`n/a: no-previous`와 구분) 표시. 계정 다이제스트 값은 출력·로그에 노출하지 않는다(기록 시점 2026-10-14).
- [#157](https://github.com/qus0in/yoroi/issues/157) 레터는 #160 후속 게시 뒤 closed. 차이 원인 미확정.

## 0.12.0 준비 (2026-10-15)

- [PR #148](https://github.com/qus0in/yoroi/pull/148)(dev→main) 범위: Free publish 가드(#144)·AA partial fallback·xAI 기본 공급자(#132 → #119)·Cursor Plus(#119)·워커 규칙(.30/.20/.10/.40·존 .60·p75 상향·$5/M 상한)·yo 필터(under·n/a·optimal)·`--pretty --full`·zen Reset 추정.
- 사용자 결정(2026-10-15): D 없이 릴리스. D는 #147(0.13.0·milestone 24)로 분리하고 실행 확인 뒤 1.0.0.
- 완료: PR #148 머지(main `baae51b`)·main CI success(run `38668219318`)·tag `v0.12.0`·Release 발행·전역 CLI 0.12.0·milestone 22 close·#119 종료. PR 초안은 scratch/reports/yoroi-m012-release-update.md.
- 0.12.1 발행 완료: PR #149 머지(main `dd589e5`)·tag `v0.12.1`·Release 발행·전역 CLI 0.12.1. xai 기본 제외·기본 5복원, yo 기본 4상태 표시·n/a 숨김·yo2/plain 전체 표시 유지.
- 0.13.0 발행 완료: `34e6eb5` xAI billing·`b8ef7b1`/`d30f6ee` Zen V2 판정/해제, PR #150·#152 머지(main `e9ce512`)·main CI·tag `v0.13.0`·Release 발행·전역 CLI·Zen V2 재설치·#147 종료·milestone 0.13.0 close. 위키 #151 별도.
- 0.13.1 발행 완료: `21918fe` 전일 partial 허용, PR #153 머지(main `a1477d0`)·main CI·tag `v0.13.1`·Release 발행·전역 CLI 0.13.1. 레터 #154 재발행(#146 종료)으로 후속 해소.
- 0.13.2 발행 완료: `20b8ac2` xAI 재로그인 안내·`6630fa1` 발행 기록·`4cd9022` 위키 원본·`38bea94` grok-build-0.1 후보·`dc0624d`/`dbd0b13` AA 거절 진단. PR #155 머지(main `0034b85ee5c1525aef455e7aa5239e0dcff7a3df`)·main CI success(run `38702663565`)·tag `v0.13.2`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.2) 발행(2026-10-15T08:08:44Z)·전역 CLI 0.13.2·위키 게시 `4495d75`·#151 종료.
- 협업 구성 표 최신화는 dev 후속 커밋 `aff156c`로 기록되며 PR #155의 main 병합에는 포함되지 않는다.
- 0.12.0 회고(2026-10-15): 리뷰 통과분은 사용자 지시에 따라 요청 없이도 작업 단위별로 묶어 커밋한다(파일 지정 add·묶음 계획 선행·동시 착륙 파일 제외). 튜닝은 scratch 시뮬레이터로 기준선 줄 단위 일치와 이웃 안정성을 먼저 확인하고 사용자 확정값만 코드에 반영한다.

## Reset (KST) 날짜 표기 후속 (2026-10-15, 완료)
- 사용자 지시: pretty Reset 날짜는 `yy-MM-dd HH:mm`으로 표시하고 시각·남은 시간·zen 추정을 유지하며 hourly에는 영향 없음.
- 완료: w1 코드·기대값(`render.ts` reset 연도 2자리), w4 문서 반영, w2 독립 리뷰·전역 갱신. 커밋은 리뷰 통과 단위로 묶는다.
- 검증: 단위 1017/1017·typecheck·diff --check·validate PASS, 합성 pretty 2자리 연도·행 열폭 균일, 전역 `once --pretty --full` 1회에서 reset 연도 2자리 확인.
- 운영 교훈: coord packet/audit가 샌드박스에서 멈추면 require_escalated 실행으로 해결됐다.

## 0.13.3 병합 (2026-10-15, 별도 발행 생략)

- [완료] PR #156 병합 `21405b0`, main CI 38716576120 success, 전역 CLI 0.13.3 설치(2026-10-15 21:54 KST 버전 확인).
- [미완료·의도] `v0.13.3` tag·Release 없음. 병합 내용은 1.0.0에 포함한다.

## 하네스 타 저장소 학습 (2026-10-20, w1/w2)

- [완료] moi·dalmuti·paul 대조 기록(`docs/insights/harness-cross-repo-learning.md`).
  이번 요청 채택: 스킬 초안(harness 사용자 학습·authoring 읽기 범위·검증),
  CI docs-only 항상-validate 분리, development 설명. 보류: 바이트예산·ledger·Herdr-only.
- [정정] 요청 시작 HEAD `5532dac` clean. 초안은 본 요청 중 root 서브에이전트
  작성 후 사용자 지시로 중단, 기존 패널이 재대조. dalmuti Herdr-only 영구정책은 미이식.
- [검증] skill validate·validate-repo.py·scripts unittest 19·diff --check PASS. 원격 CI 미실행. w2 최종 리뷰 통과.

## 현재 이슈 분배 (2026-10-20)

- 기준·완료조건: [배정 문서](insights/issue-dispatch-20261020.md).
- w1(w18:p2): #190 순수 파서·정규화/합성 검증. 소유 신규 arena-coding 파일·전용 테스트·단위 문서.
- w2(w18:p3): #180/PR #191 반영 점검. 소유 calibration-release-audit-20261020.md.
- w3(w18:p4): #168 자동감지 설계·소유경계. 소유 model-discovery-unit1.md.
- 총괄: 로스터·본 작업기록·배정문서. 각 상세 소유는 배정문서와 패킷을 따른다.
- 상태: 세 패널 모두 turn_started 확인. 공통 런타임 연결·게시·머지는 별도 후속 단위로 둔다.

## 이어하기 단위2 및 후속 정합 (2026-10-20)

- [완료] #180: CI 테스트 OS 의존 제거(ENOTDIR) 및 child fail-fast 격리 커밋 `58f5524` 완료. PR #191의 게시·CI 상태는 보고 #193에서 추적한다.
- [완료] #190 단위A: 순수 파서·타입·복합키·테스트(7/7) 구현, w3 최종 리뷰 PASS([보고서](insights/arena-final-review-20261020.md)). 초기 BLOCK 해소. 전체 이슈(수집/DB/once)는 후속.
- [완료] #168: 순수 레지스트리 핵심(diff·게이트·render·snapshot 무효세대보완) 구현, 테스트 4파일 24/24 pass, 최종 리뷰 READY·중복 diff 최종 검토 PASS([리뷰](insights/model-discovery-review-20261020.md)·[최종](insights/discovery-duplicate-review-20261020.md)). 어댑터·저장소·config·레터 연결은 후속.
- [완료] 하네스: skill-authoring 외부사실 검증 1개 보강, CI docs-only 항상-validate(`e3abe25`).
- [중간 검증] 전체 `check` 1회차 1165/1166 통과(usage-history 시간단언 1건 1278ms), 단독 3회 순차 6/6 통과(788~813ms, 미변경) 후 재실행 결과 단위 1166/1166, BDD 45/635, typecheck/build exit 0 완료([flaky-tests](flaky-tests.md)).
- [정리] 종합 상태 및 커밋 대상 그룹 분리는 [이슈별 종합 요약](insights/issue-units-summary-20261020.md) 참조.

- [이전 단위 종료 시점] CI 수정 58f5524 · Arena d0ace75 · 자동감지 핵심 5eccc2b. 당시 원격 미게시.
- [최종 검증] 기본 병렬 1166/1167(기존 SQLite 시간 단언 실패), 직렬 전체 1167/1167·BDD45/635·타입·빌드 통과. [상세](insights/final-validation-20261020.md).

## PR 갱신·보고 요청 (2026-10-20)

- 사용자 요청으로 main 병합 이력을 dev에 동기화했다(aceefc2, 파일 내용 변경 없음).
- [보고 #193](https://github.com/usagi-ai-kr/yoroi/issues/193)을 report 라벨로 생성했다.
- PR #191의 게시 SHA·원격 CI·후속 상태는 보고 #193을 기준으로 추적한다.
