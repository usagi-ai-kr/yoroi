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
- [진행] 1.0.2 R 선형 가성비 + 정규 순위 표시 보정(2026-10-16, PR #166 초안): 오케 70/5/10/15 `I/(P+0.01)` + 역할별 전체 적격 대표 모집단 midrank→Φ⁻¹→50+10z 표시. **커밋·dev push 완료**, main merge·tag·Release·전역 미실행. clean check 1042/BDD 45/632·typecheck·build PASS(`yoroi 1.0.2`)·validate PASS, **CI pending**. worker raw hunk·orchestration 제외 1.1 이월. 레터 미발행 → PR에 `Closes #160` 금지. 신규 milestone 없음. 이슈 163/164 등록만.

## 남은 작업

- [진행] 1.0.2: 커밋 `c9fde22`·dev push·PR #166 초안 완료. main CI pending. followup(compact 축약·budget test·doc price cell) 후속 커밋 단계. main merge·tag·Release·전역은 별도 승인 후.
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
