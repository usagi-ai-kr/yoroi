# 릴리스 상태와 발행 기록

- 0.4.0 이전 상세 발행 기록(v0.1.0 ~ v0.3.1) 및 과거 인증 검증 사실은 [release-history-pre040.md](release-history-pre040.md)에 보관한다.
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

## 0.4.0·0.5.0 발행 완료 (2026-10-11)

- v0.4.0: PR #91 병합(main `4744fbc`), CI success, 전역 CLI 0.4.0, Release 발행, detect 스모크 및 milestone 10 close.
- v0.5.0: PR #95 병합(main `e34f217`), CI success, 전역 CLI 0.5.0, Release 발행, milestone 0.5.0 close.

## 0.11.1 머지 및 발행 완료 (2026-10-14)

- PR [#143](https://github.com/qus0in/yoroi/pull/143) 병합 커밋 `acab7dbbd37c4d614c0284d44563b865262c88fa`(main).
- main CI [run 38549171252](https://github.com/qus0in/yoroi/actions/runs/38549171252) success.
- [v0.11.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.11.1) 발행 완료 (tag `v0.11.1`, target `acab7dbb`).
- 전역 CLI 0.11.1 동기화 완료 (`yoroi --version` 0.11.1 일치, `pnpm run update:global --check` exit 0).

## 0.5.1 머지 및 발행 완료 (2026-10-11)

- PR [#98](https://github.com/qus0in/yoroi/pull/98) 병합(main `2536baa`), CI success, [v0.5.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.1), 전역 CLI 0.5.1, #92·#93·#96·#97 및 milestone close 완료.

## 0.6.0 머지 및 발행 완료 (2026-10-12)

- [#84](https://github.com/qus0in/yoroi/issues/84) trend: 24h·7d 병행 사용량 추세 보기 구현 완료.
- Top50 수집·Top10 압축 레터 체계 구축 (`--full` 상세 플래그 유지).
- [#94](https://github.com/qus0in/yoroi/issues/94) Hermes 레터: 첫 수동 발행 [#99](https://github.com/qus0in/yoroi/issues/99), 크론 첫 자동 발행 [#100](https://github.com/qus0in/yoroi/issues/100), Top10 갱신본 반영([#100](https://github.com/qus0in/yoroi/issues/100) 댓글 2026-10-12 10:31 KST).
- 크론 스케줄 등록 완료: `yoroi-letter-daily` (일간 레터), `yoroi-weekly-report` (주간 보고).
- [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88) Zen Free 락 해제 실관측 (2026-10-12 00:22Z) 확인으로 close 완료.

- PR #101 머지(`ae7cd83`), main CI [38203425496](https://github.com/qus0in/yoroi/actions/runs/38203425496): attempt1은 `tests/cli-process.test.ts` 3000ms flaky 실패, attempt2 success. [v0.6.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.6.0) 발행 완료.
- 전역 CLI 0.6.0은 `v0.6.0` 태그 worktree에서 설치했다. #84·#77·#88 및 0.3.1 milestone close 완료. 0.6.0 milestone은 #94 크론 관측 대기로 open 유지.

## 0.7.0 준비 상태 (2026-10-12)

- 0.7.0 milestone: #102 OpenCode Data 내부 참조 수집(dailyTokens 파서·리더보드 키 진단), #103 순위 규칙, #104 요금제상 최적, #105 `--markdown`을 묶어 dev → main PR 준비.
- #102 크롤러 작업·진단 완료. 리더보드 파서는 내일 진단 결과 후 진행한다(승계 작업 없음).
- 크론 출력은 0.6.0부터 `--pretty` 압축 Top10, 0.7.0부터 `--markdown`이다.

## 0.8.0 머지 및 발행 완료 (2026-10-12)

- v0.7.0 발행 완료(PR #106 → `025d16a`, main CI 38217518529 success, Release https://github.com/qus0in/yoroi/releases/tag/v0.7.0, 전역 CLI 0.7.0 태그 worktree 설치).
- v0.8.0 발행 완료: PR #109 머지 커밋 `a54af3e`, main CI [38232400154](https://github.com/qus0in/yoroi/actions/runs/38232400154) success, [v0.8.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.0) 발행, 전역 CLI 0.8.0 태그 worktree 설치.
- 0.8.0의 #108 통합 Top10: 보유 요금제 접근 모델만, 추천 역할·effort 표시, DeepSeek 4.1 Flash는 AA 미수록이라 4 Flash 지수 하한(사용자 확인)·공식 단가.
- 0.8.0의 통합 Top10(#108)은 사용자 의도 오해로 [#111](https://github.com/qus0in/yoroi/issues/111)에서 오케스트레이터/워커 Top10 별도 유지(이중 자격 모델은 양쪽 표시)로 정정 중이다.
- [#110](https://github.com/qus0in/yoroi/issues/110) 레터는 통합 형식으로 발행돼 #111 갱신본 반영 후 재발행 예정이다.
- 0.8.1: #111 정정(오케/워커 분리 표시) 및 #110 갱신본 재발행을 묶어 dev → main PR 준비 중.
- #111 범위: 오케스트레이터·워커 Top10을 별도 유지하고 교집합 모델은 양쪽에 `↔` 표시; GPT 6.x가 있으면 지표와 무관한 전체 접근 모델 기준으로 GPT 5.6 luna·terra·sol을 제외한다.
- Kimi K3 한도 참고(2026-10-12): OpenCode Go Plus 440회/5h 추정([공식 안내](https://opencode.ai/go)); Ollama Cloud Pro 크레딧 $60/월·토큰 차감·동시 3([요금](https://ollama.com/pricing)).
- #107 SQLite WAL 동시 오픈 재현 실패 기록: 400라운드에서 실패 0회.
- 참고 순위 토큰값 퇴행 수정은 zen 진행 중.

## 0.8.1–0.8.3 발행 및 0.8.4 준비 (2026-10-13)

- v0.8.1(PR #112 → main `57b379d`, CI attempt 2)·v0.8.2(PR #114 → `e631228`)·v0.8.3(PR #120 → `81b264c`) 발행 완료, 전역 CLI 동기화. #113·#107·#116·#117 close 및 0.8.2·0.8.3 milestone close.
- 상세 근거·CI run 번호는 git log와 [tasks.md](tasks.md) 기록으로 대체한다(중복 정리).

## 0.8.4–0.10.0 발행 완료 (2026-10-13~14)

- v0.8.4~v0.8.6, v0.9.0, v0.10.0 순차 발행 완료 (PR #122·124·126·128·130·139 → main, 전역 CLI 동기화 완료).
- 0.9.0: MiMo 구세대 제거·요금제 별도 표·SQLite 전량 적재·Arena 수집 제거·역할 재정립.
- 0.10.0: 점수 가중치 외부화·오케 사용량 차원·협업 분배 CLI(`coord`) 도입.

## 버전 이력 요약

- 0.1.0–0.6.0 (2026-10-08~12): MVP, Zen Free, watch/cache, 레터, 발행 기록은 [release-history-pre040.md](release-history-pre040.md) 참조.
