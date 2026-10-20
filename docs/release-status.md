# 릴리스 상태와 발행 기록

- 0.4.0 이전 상세 발행 기록(v0.1.0 ~ v0.3.1) 및 과거 인증 검증 사실은 [release-history-pre040.md](release-history-pre040.md)에 보관한다.
- 0.4.0~0.11.1 발행 기록은 [release-history-pre100.md](release-history-pre100.md)에 옮겨 보관했다.
- 0.13.2 정리 과정의 과거 상세 발행 기록은 [tasks-archive-2.md](tasks-archive-2.md)에 보관한다.
- main 병합은 dev → main PR로만 진행한다(직접 push 금지).
- PR 머지 뒤 원격 CI 통과를 확인하고, 버전 갱신 시 `global-cli-update` 스킬과 [docs/global-install.md](global-install.md) 절차로 전역 CLI를 갱신하고 버전 일치를 확인한다.

## 1.7.1–1.7.3 핫픽스 (2026-10-20, PR #204/#207/#209 → main `124d8cd`/`428f0d1`/`a25e97c`)

- 범위: 발행 게이트 state 대소문자(#204), 3역할 순서=최종 ranked entries(#207), 표시 스코어 scoreText·enriched top10·내부 머리글 제거(#209). 각 PR CI·main CI success, Release v1.7.1/v1.7.2/v1.7.3, 전역 CLI 1.7.3.
- [완료] 최종 Actions run [39415145667](https://github.com/usagi-ai-kr/yoroi/actions/runs/39415145667) success · 레터 [#210](https://github.com/usagi-ai-kr/yoroi/issues/210) 검증 PASS 16/0/0 · #192/#205/#208 closed(교체 이력 보존) · #194/#199 close · milestone 30 close.
- [보류] #198 umbrella open, #180/#202 격리 기준 유지·보류.

## 1.7.0 발행 완료 (2026-10-20, PR #203 → main `0331f7e6808fc928362666c7b2dc061a437e63a2` = tag `v1.7.0`)

- 범위(minor): #168 adaptive discovery(관측 스냅샷 저장 + 공식 Free 교차 등록, 기본 off) · #190 Arena 코딩 근거 · #196 공식 페이지 Free 권위·last-good · #194 Actions 3역할·당일 교체 게이트. 검증: 단위 1361/1361·BDD 45/635·validate 940 files·교차 리뷰 PASS. main CI [39406093890](https://github.com/usagi-ai-kr/yoroi/actions/runs/39406093890) success, 전역 1.7.0 확인 후 v1.7.1로 대체.

## 0.12.0 발행 완료 (2026-10-15, PR #148 머지 → main `baae51b`·milestone 22 close)

- 범위(milestone 22): Free 섹션 publish 가드(#144 원인 대응)·AA partial 저장본 fallback·xAI opencode stats 기본 공급자(#132 흡수)·Cursor Plus 카탈로그(#119)·
  워커 규칙(.30/.20/.10/.40·존 .60·보유 플랜 p75 상향·혼합 단가 $5/M 상한)·yo 필터(under·n/a·optimal, 숨김 provider 행 유지)·`--pretty --full`·zen Reset 추정 표시.
- 사용자 결정(2026-10-15): D(xAI 구독 사용률) 없이 릴리스. D는 [#147](https://github.com/qus0in/yoroi/issues/147)(0.13.0, [milestone 24](https://github.com/qus0in/yoroi/milestone/24))로 분리하고 실행 확인 뒤 1.0.0으로 판올림한다.
- 검증: 항목별 리뷰 approve·단위·BDD 통과(작업 트리 동시 변경으로 최종 수치는 릴리스 커밋에서 재확인). PR은 `Closes #119`로 #119를 종료했다. 버전 승격(`0.11.1` → `0.12.0`, 커밋 `f7eb602`)·커밋 7건 push·[PR #148](https://github.com/qus0in/yoroi/pull/148) 머지 완료(main `baae51b`, 2026-10-15T01:54:31Z)·main CI success(run `38668219318`)·tag `v0.12.0`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.12.0) 발행·전역 CLI 0.12.0 동기화·milestone 22 close.

## 0.12.1 발행 완료 (2026-10-15, PR #149 머지 → main `dd589e5`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.12.1))

- 범위(patch, 불필요 기본 행 복원 bugfix): xai 기본 수집 제외(기본 5복원)·yo 기본(limit·under·optimal·over 표시·n/a 숨김)·yo2(`--pretty --full`)/plain 전체 표시 유지·지원 목록 opt-in 유지(`YOROI_PROVIDERS=xai` 호환). 이전 운영 정리 `91c1d71` 동봉. D는 [#147](https://github.com/qus0in/yoroi/issues/147)(0.13.0) 유지.

## 0.13.0 발행 완료 (2026-10-15, PR #150·#152 머지 → main `e9ce512`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.0))

- 범위(minor, [versioning.md](versioning.md) 근거: xAI 구독 주간 billing 수집·Zen Free V2 판정/해제): `34e6eb5` xAI billing 주간 사용량·`b8ef7b1`/`d30f6ee` Zen V2 free 판정 분리·성공 해제. [PR #150](https://github.com/qus0in/yoroi/pull/150) 머지 `ec8c4f4`·[PR #152](https://github.com/qus0in/yoroi/pull/152) 머지 `e9ce512`로 main 반영, 버전 승격 `0.12.1` → `0.13.0`·main CI success(run `38692181120`)·tag `v0.13.0`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.0) 발행(2026-10-15T06:33:49Z)·전역 CLI 갱신·Zen V2 플러그인 재설치·[#147](https://github.com/qus0in/yoroi/issues/147) 일치 확인 후 종료·milestone 0.13.0 close. [#151](https://github.com/qus0in/yoroi/issues/151) 위키 최신화는 별도.

## 0.13.1 발행 완료 (2026-10-15, PR #153 머지 → main `a1477d0`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.1))

- 범위(patch, [versioning.md](versioning.md) 근거: 인사이트 레터 전일 AA 비교 오류 수정): `21918fe` 전일 AA 비교 조회 시 `includePartial: true` 전달로 complete=0(partial) 저장본도 비교 기준 랭크 산출에 허용(#146). 버전 승격 `0.13.0` → `0.13.1`·[PR #153](https://github.com/qus0in/yoroi/pull/153) 머지 `a1477d0`·main CI success(run `38693809267`)·tag `v0.13.1`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.1) 발행(2026-10-15T06:54:43Z)·전역 CLI 0.13.1. 레터 [#154](https://github.com/qus0in/yoroi/issues/154) 재발행(#146 종료)으로 후속 해소.

## 0.13.2 발행 완료 (2026-10-15, PR #155 머지 → main `0034b85ee5c1525aef455e7aa5239e0dcff7a3df`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.2))

- 범위(patch, [versioning.md](versioning.md) 근거: xAI 재로그인 안내·위키 원본 갱신·grok-build-0.1 후보·AA 거절 사유 진단 집계/저장): `20b8ac2` xAI 인증 오류 OpenCode 재로그인 안내·`6630fa1` 0.12.1~0.13.1 발행 기록·`4cd9022` 위키 원본 갱신·`38bea94` grok-build-0.1 SuperGrok 후보 추가·`dc0624d` AA 거절 사유 집계·`dbd0b13` AA 거절 진단 일일 저장본 보존. 버전 승격 `0.13.1` → `0.13.2`·PR #155 머지 `0034b85ee5c1525aef455e7aa5239e0dcff7a3df`·main CI success(run `38702663565`)·tag `v0.13.2`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.2) 발행(2026-10-15T08:08:44Z)·전역 CLI 0.13.2·위키 [#151](https://github.com/qus0in/yoroi/issues/151) 원격 게시 `4495d75`·이슈 종료.

## 0.13.3 병합 (2026-10-15, 별도 발행 생략)

- [완료] PR #156 병합 `21405b0`(2026-10-15 18:55 KST, 사용자 승인 범위), main CI [38716576120](https://github.com/qus0in/yoroi/actions/runs/38716576120) success, 전역 CLI 0.13.3 설치(2026-10-15 21:54 KST 버전 확인).
- [결정] 별도 tag `v0.13.3`·Release는 만들지 않는다. 병합 내용은 1.0.0에 포함한다(v1-finalization-plan.md 범위 확정).
- [미완료·의도] `v0.13.3` tag와 Release는 없다(원격 태그·Release 목록 확인).
- 범위: xAI 주간 기본 복원·누락 응답 parser 지원·`w` 표시·Reset `yy-MM-dd`.

## 1.0.0 발행 완료 (2026-10-15, PR #158 머지 → main `5111378cccf5f2436db0f1fae8c0715e76c94edb`)

- 범위: main 0.13.3까지의 동작 + 버전 1.0.0 + 운영 문서 정정. 신규 기능 없음. 0.13.3은 별도 tag·Release 없이 포함.
- [완료] PR #158 머지 `5111378cccf5f2436db0f1fae8c0715e76c94edb` · main CI [38744891994](https://github.com/qus0in/yoroi/actions/runs/38744891994) success · tag `v1.0.0` · [Release](https://github.com/qus0in/yoroi/releases/tag/v1.0.0) 발행(2026-10-15T13:50:05Z, 동일 SHA) · 전역 CLI 1.0.0(`update:global --check` exit 0) · [milestone 23](https://github.com/qus0in/yoroi/milestone/23) close.
- 전역 최초 준비는 0.13.3이었다. 설치 시점에 이미 1.0.0 dirty(1.1 effort 혼입)가 있어 clean SHA 재설치 후 1.0.0만 확정했다.
- [보존] 미커밋 워커 effort 3파일과 `docs/orchestration.md` 타 주체 변경은 1.0 커밋에서 뺐고 워킹트리에 유지한다. 1.1에서 xhigh 상한과 함께 검토한다.

## 1.0.1 발행 완료 (2026-10-15, patch)

- 범위: Grok 4.6/4.7 세대 예외(4.5 제외·Sol 독립 유지) + 1.0.0 기록 문서. 신규 기능·새 milestone 없음.
- [완료] PR #159 머지 `c7c403eec32e5cc73a98f3a2852df3fd75833e4e` · main CI [38753176387](https://github.com/qus0in/yoroi/actions/runs/38753176387)(attempt 1 lease flaky 실패·attempt 2 success) · tag `v1.0.1` · [Release](https://github.com/qus0in/yoroi/releases/tag/v1.0.1)(publishedAt 2026-10-15T14:47:25Z, 동일 SHA) · 전역 CLI 1.0.1(`--check` exit 0, clean 재설치).
- [완료] 레터: [#160](https://github.com/qus0in/yoroi/issues/160)(Grok 4.6) 발행·4.6행 GET 확인 후 #157 댓글·close. #157과 차이 원인 미확정 유지.
- [제외] 1.1 effort 3파일·orchestration·takeover 보존.

## 1.0.2 발행 완료 (2026-10-16, PR #169 머지 → main `adea4d33868b6b40219fdf4da06de1e0e637a2d2` = tag `v1.0.2`)

- 범위: (1) 오케 R 4차원 선형 가성비 복구(70/5/10/15, `valueForMoney = I/(P+0.01)`·log10 유지·Cog USD/task 역방향 소스별 min-max 후 차원 max) (2) 역할별 전체 적격 대표 모집단 midrank → Φ⁻¹ → 50+10z **표시 보정** (3) #164 warn(90% 이상 표시·계약 문서) (4) #165 Antigravity `gemini-4-argon` 카탈로그 (5) #167 `muse-spark-open` 카탈로그·공개근거. 신규 milestone 없음.
- [완료] dev 커밋 `44253ed`(warn·Argon·Muse 코드/테스트/문서 47파일)를 PR #169(dev→main)로 머지 → main `adea4d33868b6b40219fdf4da06de1e0e637a2d2` = tag `v1.0.2` = [Release](https://github.com/qus0in/yoroi/releases/tag/v1.0.2)(publishedAt 2026-10-16T06:01:24Z). **전역 갱신·레터 발행은 별도 단계.**
- [보존] **1.1 워커 이월**: worker hunk(`letter-top10-score.ts`·`four-source-score.md`)·`orchestration.md`·takeover·`insights-worker-effort-source.test.ts`는 1.0.2 소스에서 제외하고 워킹트리에 보존. worker raw 30/20/10/40·하한33·가산5 불변.
- [후속] **1.0.3 준비**: 워커 effort 라벨-지표 소스 불일치(AA Max 지표에 Cog high 라벨) 최소 수정 후보 — [release-103-effort-fix-candidate.md](insights/release-103-effort-fix-candidate.md). tag `v1.0.3`·Release·레터는 별도 승인 흐름.
- [등록만] 이슈 [#163](https://github.com/qus0in/yoroi/issues/163) ban·[#164](https://github.com/qus0in/yoroi/issues/164) warn — 버전·milestone 미지정, 구현은 warn만 후보 포함.

## 1.3.0 발행 완료 (2026-10-19, PR #189 → main `1e37897417e8ba9cfde35cc77d2fe24fd55c6d48` = tag `v1.3.0`, [#188](https://github.com/usagi-ai-kr/yoroi/issues/188))

- 범위(minor): 레터 추천 effort가 실행 환경 가용성을 넘지 않도록 정책 도입 — `config/effort-availability.json` 환경별 cap·`YOROI_EFFORT_PROFILE` opt-in, 점수 산출 effort와 표시 effort 일치(cap 필터 전 경로 적용), benchmarkEffort를 무cap 풀 재점수(점수 최적)로 정정, 가용성 스냅샷 단일 전파(현재·전일 순위·마크다운 Top7/Top15·compact·Free), compact 짧은 마커(▲/?) 예산 준수. 정책 문서: [effort-availability.md](insights/effort-availability.md).
- [검증] unit 1105/1105·BDD 45/635·typecheck 0·build·validate PASS(777 files). 워커 집중 테스트에 없던 전체 check 7건 실패를 오케스트레이터 감사에서 발견→수정 후 통과. 독립 리뷰 4라운드(구현 w2·리뷰 w1 분리) 최종 READY.
- [완료] PR CI pass(2/2) · 머지 `1e37897` · main CI [39235652099](https://github.com/usagi-ai-kr/yoroi/actions/runs/39235652099) success · [Release v1.3.0](https://github.com/usagi-ai-kr/yoroi/releases/tag/v1.3.0) · 전역 CLI 1.3.0(`--check` exit 0) · #188 close(PR Closes). milestone 미운영(이슈 직접 추적).
- [잔여] compact 수기 입력 effort 패리티(LOW) · Sonnet 제공 경로 미검증(#168형 감지 후속) · run-once 전일-순위 동등성 단언 1줄 후속.

## 1.2.1 발행 완료 (2026-10-16, PR #183 → main `003651db415bd6ea5a68e6924f05c85f8c61524c` = tag `v1.2.1`, milestone 28, [#182](https://github.com/qus0in/yoroi/issues/182))

- 범위(patch): 오케스트레이터 사용량 차원 제외(`0.75/0/0.10/0.15`, `성능/속도/가성비` 3열) · `ban.orchestrator`에 `gpt-6-luna`·`claude-haiku-5-5` 추가 · `allowOlder`에서 `grok-4-6` 제외(`grok-4-7` 단일화) · 오케↔워커 역할 간 속도 결측 대체([letter-121-spec.md](insights/letter-121-spec.md)).
- [검증·완료] unit 1087/1087·BDD 45/45·typecheck·validate PASS, w2 교차 리뷰 차단 0 · main CI [38880504944](https://github.com/qus0in/yoroi/actions/runs/38880504944) success · [Release v1.2.1](https://github.com/qus0in/yoroi/releases/tag/v1.2.1) · 전역 CLI 1.2.1(`--check` exit 0) · 레터 [#184](https://github.com/qus0in/yoroi/issues/184)(2026-10-16 18:29 KST, 댓글 3건) 발행 후 #181 close · #182 close(PR Closes) · milestone 28 close.

## 1.2.0 발행 완료 (2026-10-16, PR #179 → main `d8bed39c88f42e93e821a90c4df09d90729a239b` = tag `v1.2.0`, milestone 27, [#178](https://github.com/qus0in/yoroi/issues/178))

- 범위(minor): 인사이트 레터 마크다운을 본문 Top7(오케·워커 각 7행) + 순서 고정 댓글 3개(① 오케 Top15+퇴장 ② 워커 Top15+퇴장 ③ Free 티어)로 분리(`TOP_N=15`, `LetterParts`·`joinLetterParts`, Free 가드 댓글 3 적용, 댓글 실패 시 close 금지). 명세: [letter-format-1.2.md](insights/letter-format-1.2.md).
- [검증] unit 1086/1086·BDD 45/45·typecheck·validate PASS, w3 발행 리뷰·w2 렌더 교차 리뷰 차단 0, 본문 1–7위 모델·스코어·변동이 #175(1.1.0) 스냅샷 1–7위와 일치.
- [완료] main CI [38876943266](https://github.com/qus0in/yoroi/actions/runs/38876943266) success · [Release v1.2.0](https://github.com/qus0in/yoroi/releases/tag/v1.2.0) · 전역 CLI 1.2.0(`--check` exit 0) · 레터 [#181](https://github.com/qus0in/yoroi/issues/181)(2026-10-16 17:58 KST, 댓글 3건) 발행 후 #175 close · #178 close(PR Closes) · milestone 27 close.

## 1.4.0 발행 (2026-10-20, PR #191 → main `ff831c6482c618fc503503dd33d63acece519917` = tag `v1.4.0`)

- 범위: Free 캘리브레이션(opt-in 명령만 호출)·Arena 코딩 파서·모델 감지 핵심·MiniMax M3.1 Free·발행 복구 게이트·하네스 위탁 우선·Actions 초안.
- [검증] typecheck·unit 1223/1223·BDD 45/635·빌드·validate PASS(병합 전 dev 기준).
- [완료] main CI [39357397662](https://github.com/usagi-ai-kr/yoroi/actions/runs/39357397662) success · [Release v1.4.0](https://github.com/usagi-ai-kr/yoroi/releases/tag/v1.4.0)(2026-10-20T02:12:27Z) · 전역 CLI 1.4.0 · #180 open 유지.

## 버전 이력 요약

- 1.0.3–1.1.1 (2026-10-16): 발행 기록은 [release-history-pre120.md](release-history-pre120.md)로 옮겨 보관했다.
- 0.1.0–0.6.0 (2026-10-08~12): MVP, Zen Free, watch/cache, 레터, 발행 기록은 [release-history-pre040.md](release-history-pre040.md) 참조.
- 0.4.0–0.11.1 (2026-10-11~14): 발행 기록은 [release-history-pre100.md](release-history-pre100.md) 참조.
