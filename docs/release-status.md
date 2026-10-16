# 릴리스 상태와 발행 기록

- 0.4.0 이전 상세 발행 기록(v0.1.0 ~ v0.3.1) 및 과거 인증 검증 사실은 [release-history-pre040.md](release-history-pre040.md)에 보관한다.
- 0.4.0~0.11.1 발행 기록은 [release-history-pre100.md](release-history-pre100.md)에 옮겨 보관했다.
- 0.13.2 정리 과정의 과거 상세 발행 기록은 [tasks-archive-2.md](tasks-archive-2.md)에 보관한다.
- main 병합은 dev → main PR로만 진행한다(직접 push 금지).
- PR 머지 뒤 원격 CI 통과를 확인하고, 버전 갱신 시 `global-cli-update` 스킬과 [docs/global-install.md](global-install.md) 절차로 전역 CLI를 갱신하고 버전 일치를 확인한다.

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

## 1.2.0 발행 준비 (2026-10-16, milestone 27, [#178](https://github.com/qus0in/yoroi/issues/178))

- 범위(minor): 인사이트 레터 마크다운을 본문 Top7(오케·워커 각 7행) + 순서 고정 댓글 3개(① 오케 Top15+퇴장 ② 워커 Top15+퇴장 ③ Free 티어)로 분리(`TOP_N=15`, `LetterParts`·`joinLetterParts`, Free 가드 댓글 3 적용, 댓글 실패 시 close 금지). 명세: [letter-format-1.2.md](insights/letter-format-1.2.md).
- [검증] unit 1086/1086·typecheck·validate PASS, w3 발행 리뷰·w2 렌더 교차 리뷰 차단 0, 본문 1–7위 모델·스코어·변동이 #175(1.1.0) 스냅샷 1–7위와 일치.

## 1.1.1 발행 완료 (2026-10-16, PR #177 → main `29c968fe8ea05037563f77690786a69b21c1f890` = tag `v1.1.1`, milestone 26, [#176](https://github.com/qus0in/yoroi/issues/176))

- 범위(patch): 전역 CLI가 레터 모델 목록 설정을 읽도록 `YOROI_LETTER_MODEL_LISTS` → `${XDG_CONFIG_HOME:-~/.config}/yoroi/letter-model-lists.json` → 레포 config → 기본값 순으로 해석. 파싱 실패는 stderr 경고 1줄. 밴은 오케·워커별(`ban.common` 하위호환), 버전 허용 `allowOlder`는 공통(사용자 확정).
- [검증] unit 1080/1080·typecheck·validate PASS, 경로 테스트 6건(w1), 구현 리뷰 o(문서 예시 정정 1건).
- [완료] main CI [38873193798](https://github.com/qus0in/yoroi/actions/runs/38873193798) success · [Release v1.1.1](https://github.com/qus0in/yoroi/releases/tag/v1.1.1) · 전역 CLI 1.1.1(`--check` exit 0) · #176 close · milestone 26 close. 레터 재발행 없음(기본값 동작 불변).
- [스모크] 전역 CLI에 오케 밴 `claude-opus-5-5` 지정 시 오케 Top10에서만 빠지고 선두 `gpt-6-1-sol`, 워커 선두 불변. 잘못된 파일은 경고 1줄.

## 1.1.0 발행 완료 (2026-10-16, PR #174 → main `431bc7ce1245753b27280b1eaf88a1bac9e2b281` = tag `v1.1.0`)

- 범위(minor): [#163](https://github.com/qus0in/yoroi/issues/163) 밴 목록 + 하위버전 화이트리스트를 `config/letter-model-lists.json`으로 옮김(`allowOlder`·`excludePatterns`·`ban`). 명세: [letter-model-lists-1.1.md](insights/letter-model-lists-1.1.md).
- [검증] unit 1074/1074·typecheck·validate PASS, w1 리뷰 차단 0([리뷰](insights/letter-model-lists-review-w1.md)), 기본 config 렌더 = 1.0.3 렌더 바이트 동일.
- [비차단] 교차 family에서 목록 모델이 successor 쪽일 때 predecessor 보호(현 데이터 영향 0) — 1.1.x 후속.
- [완료] main CI [38870609040](https://github.com/qus0in/yoroi/actions/runs/38870609040) success · [Release v1.1.0](https://github.com/qus0in/yoroi/releases/tag/v1.1.0) · 전역 CLI 1.1.0(`--check` exit 0) · 레터 [#175](https://github.com/qus0in/yoroi/issues/175)(2026-10-16 17:01 KST) 발행 후 #171 close · #163 close(PR Closes) · milestone 25 close.
- [참고] 전역 설치본은 `files`=dist라 `config/letter-model-lists.json`이 없고 기본값으로 동작한다(held-plans와 같은 fallback).

## 1.0.3 발행 완료 (2026-10-16, PR #170 머지 → main `ea381c61b794390c43ac85cc2b515f0022c1af2a` = tag `v1.0.3`)

- 범위(patch): 워커 effort 표기·AA 측정 소스 정합 1줄 + 신규 3케이스 + 버전 1.0.3 + 문서 8. max cap 없음.
- [완료] dev 커밋 `aba39d9` → PR #170 머지 → main CI success(run `38861070165`) · tag `v1.0.3` · [Release](https://github.com/qus0in/yoroi/releases/tag/v1.0.3)(publishedAt 2026-10-16T06:31:13Z, 동일 SHA, Latest) · 전역 CLI 1.0.3(`--check` exit 0, clean archive) · 레터 [#171](https://github.com/qus0in/yoroi/issues/171) 발행(DeepSeek worker `max` 59.3·Argon 6위) 후 #162·#165 close.
- [종료] #164·#167(PR #169 Closes) · #165(레터 후 직접) · #162(후속 레터 후). #163·#168·#141·#29 open 유지.
- [보존] 워킹트리 원본 dirty 유지(main 반영분과 별개): score 1.1 hunk 전체·four-source·orchestration·takeover·worker-effort-source 테스트.
- [검증] 하네스 latest: full unit 1068·8 skills, 상시 skill 자동 적용, exit 4/5/6·300초. 제품 1.0.3·레터 #171 완료와 정합.

## 버전 이력 요약

- 0.1.0–0.6.0 (2026-10-08~12): MVP, Zen Free, watch/cache, 레터, 발행 기록은 [release-history-pre040.md](release-history-pre040.md) 참조.
- 0.4.0–0.11.1 (2026-10-11~14): 발행 기록은 [release-history-pre100.md](release-history-pre100.md) 참조.
