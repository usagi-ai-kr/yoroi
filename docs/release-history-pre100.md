# 릴리스 발행 기록 보관본 (1.0.0 이전)

- 2026-10-15 1.0.0 문서 정리 때 [release-status.md](release-status.md)와 [roadmap.md](roadmap.md)에서 원문 그대로 옮겼다.
- 0.4.0 이전 발행 기록은 [release-history-pre040.md](release-history-pre040.md)에 있다. 0.12.0 이후는 [release-status.md](release-status.md)를 본다.

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

## 로드맵 이전 기록: 버전별 메모 (0.9.0~0.13.3, 2026-10-15 이동)

- `package.json` 버전은 `0.13.3`으로 승격 준비 중이다. 직전 발행과 전역 CLI 스냅샷은 `0.13.2`([v0.13.2 Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.2)); 버전 원본은 `package.json`이다.
- 0.9.0 범위(minor, [versioning.md](versioning.md) 근거: Arena 소스 제거·Top10 산정 규칙 변경·DB scope `:all` 추가): MiMo 구세대 세대 제외·접근 요금제 별도 표(Top10 unique 모델 × 요금제 ☑/☐)·SQLite 전량 적재 후 재조회 렌더·Arena 수집 제거·AA 미측정 근거 유지·오케스트레이터/워커 역할 재정립. 상태: 이 브랜치에 포함(0.10.0과 함께 머지 예정).
- 0.10.0 범위(minor, [versioning.md](versioning.md) 근거: 점수 가중치 외부 설정·오케 사용량 차원과 사용량 열 추가·협업 분배 CLI 도입): `config/score-weights.json` 외부화와 오케 70/5/10/15·워커 30/20/10/40, 오케 가성비 결합(AA I²/P와 Cognition USD/task 소스별 min-max 후 max), 오케 레터 사용량 열 복구, agy c-5h 한도 라벨, 협업 CLI `coord`(분배·상태·전송·감사·감시·워크스페이스 해석)와 토큰 절약 digest. 상태: 발행 완료([v0.10.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.10.0), PR #139 → main `245d538`).
- 0.11.0 범위(minor, [versioning.md](versioning.md) 근거: 오케 스코어 차원 구성 변경·Free 티어 표 구조 변경, [0.11.0 milestone](https://github.com/qus0in/yoroi/milestone/21)): 오케 가성비 차원 제거와 가중치 82/6/12(70:5:10 비례 재배분, `config/score-weights.json`에서 오케 `price` 키 제거), 오케 표 차원 열 `성능/사용량/속도`, 워커 30/20/10/40 불변, 파레토 열은 단가 대비 스코어 기준 유지(결정은 사용자), `## 🆓 Free 티어` 한 표(`모델|오케|워커|Free 경로|비고`)와 가성비 잔재 정리, 분배 원칙·p73~p76 기록. 상태: PR [#140](https://github.com/qus0in/yoroi/pull/140) 진행 중(머지 대기), 같은 milestone의 [#119](https://github.com/qus0in/yoroi/issues/119) Cursor 요금제는 PR #148에서 종료).
- 0.12.0 범위(minor, [versioning.md](versioning.md) 근거: 감시 소스 xAI 추가·Cursor Plus 요금제 반영·레터 Free 발행 가드·워커 점수 체계 변경): xAI opencode stats 기본 공급자(소비량만)·Cursor Plus $8/월 주간 풀 카탈로그(Composer 2.5 제외)·Free 섹션 publish 가드·AA partial fallback·워커 가중치 .30/.20/.10/.40·존 .60·보유 플랜 p75 상향·혼합 단가 $5/M 상한·yo 필터(under·n/a·optimal)·`--pretty --full`·zen Reset 추정 표시. 상태: [PR #148](https://github.com/qus0in/yoroi/pull/148) 머지 완료(main `baae51b`)·main CI success·tag `v0.12.0`·Release 발행·전역 CLI 0.12.0·milestone 22 close, #119 종료.
- 0.12.1 준비(patch, [versioning.md](versioning.md) 근거: 불필요 기본 행 복원 bugfix): xai 기본 수집 제외·기본 5복원, yo 기본(limit·under·optimal·over 표시·n/a 숨김)·yo2(`--pretty --full`)/plain 전체 표시 유지, 명시 선택 opt-in(`YOROI_PROVIDERS=xai`) 호환 유지. 이전 운영 정리 `91c1d71` 동봉. D는 [#147](https://github.com/qus0in/yoroi/issues/147)(0.13.0) 유지. 상태: PR #149 머지(main `dd589e5`)·tag `v0.12.1`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.12.1) 발행·전역 CLI 0.12.1.
- 0.13.0 준비(minor, [versioning.md](versioning.md) 근거: xAI 구독 주간 billing 수집·Zen Free V2 판정/해제): `34e6eb5` xAI billing·`b8ef7b1`/`d30f6ee` Zen V2 free 판정 분리·성공 해제, PR #150 머지(`ec8c4f4`)·[PR #152](https://github.com/qus0in/yoroi/pull/152) 머지(`e9ce512`)·버전 승격 0.13.0·main CI success·tag `v0.13.0`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.0) 발행·전역 CLI 갱신·Zen V2 재설치·milestone 0.13.0 close. 상태: 발행 완료. [#147](https://github.com/qus0in/yoroi/issues/147) 일치 확인 후 종료, 위키 [#151](https://github.com/qus0in/yoroi/issues/151) 별도.
- 0.13.1 준비(patch, [versioning.md](versioning.md) 근거: 레터 전일 AA 비교에 partial 허용 bugfix): `21918fe` 전일 complete=0 저장본을 includePartial로 읽어 전일 자료 없음 오경보 해소(#146), [PR #153](https://github.com/qus0in/yoroi/pull/153) 머지(`a1477d0`)·main CI success·tag `v0.13.1`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.1) 발행·전역 CLI 0.13.1. 상태: 발행 완료. 레터 [#154](https://github.com/qus0in/yoroi/issues/154) 재발행(#146 종료)으로 후속 해소.
- 0.13.2 발행 완료(patch, [versioning.md](versioning.md) 근거: xAI 재로그인 안내·위키 원본 갱신·grok-build-0.1 후보·AA 거절 사유 진단 집계/저장): `20b8ac2` xAI 재로그인 안내·`6630fa1` 발행 기록·`4cd9022` 위키 원본·`38bea94` grok-build-0.1 후보·`dc0624d`/`dbd0b13` AA 거절 진단 집계/저장. PR #155 머지(main `0034b85ee5c1525aef455e7aa5239e0dcff7a3df`)·main CI success(run `38702663565`)·tag `v0.13.2`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.2) 발행(2026-10-15T08:08:44Z)·전역 CLI 0.13.2·위키 원격 게시 `4495d75`·[#151](https://github.com/qus0in/yoroi/issues/151) 종료. 상태: 발행 완료.
- 0.13.3 patch: xAI 주간 기본 복원·누락 응답 parser 지원·`w` 표시·Reset `yy-MM-dd`. 사용자 승격·PR #156 머지·발행 승인 완료. 최종 근거는 [PR #156](https://github.com/qus0in/yoroi/pull/156)·[v0.13.3 Release](https://github.com/qus0in/yoroi/releases/tag/v0.13.3) 페이지에서 확인하며 merge SHA·CI·발행·전역 설치 완료는 선기록하지 않는다.
- 다음: D(xAI 구독 사용률)는 사용자 결정(2026-10-15)으로 [#147](https://github.com/qus0in/yoroi/issues/147)(0.13.0, [milestone 24](https://github.com/qus0in/yoroi/milestone/24))에 분리한다. 0.12.0 릴리스 뒤 D 실행을 확인하고 [1.0.0 milestone](https://github.com/qus0in/yoroi/milestone/23)으로 판올림한다.

## 로드맵 이전 기록: 상태 요약·PR #67·발행 기록 (2026-10-15 이동)

- minor 증가 시 patch를 0으로 초기화한다. 직전 발행은 `v0.6.0`(main `ae7cd83`), 다음 후보는 `0.7.0`이다.
  기능 계획은 `0.2.0`–`0.6.0`([#70](https://github.com/qus0in/yoroi/issues/70)–[#89](https://github.com/qus0in/yoroi/issues/89))으로 분리했다(2026-10-11 재번호).
- PR #67 병합(merge `62ef080`, 2026-10-08T13:16:52Z): 서브커맨드 도움말(`ff3371c`)·문서 정리(`3dadf92`) 반영 완료.
  PR CI `37780797515` success, main workflow_dispatch CI `37783139920` success.
- 현재 상태 요약: **v0.6.0 발행 완료**(PR #101 → `ae7cd83`, main CI 38203425496 attempt2 success). v0.5.1(tag → `2536baa`, main CI 38141050373)·0.5.0·0.4.0·0.3.0·0.2.0도 발행됐다.
  0.6.0 발행 범위([#84](https://github.com/qus0in/yoroi/issues/84) trend 24h·7d, [#94](https://github.com/qus0in/yoroi/issues/94) Hermes 레터 #99·#100, 크론 2종 등록, Top50/Top10, #77·#88 해제 실관측 반영).
  [#29](https://github.com/qus0in/yoroi/issues/29) open·hold 유지.
- 다음 후보: PR #67 변경을 담을 0.1.3 tag·Release 필요 여부는 사용자 결정(주의: opencode worker는 무료 모델 소진 시 구 패킷 재실행 주의).
- `v0.1.0` tag·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행 완료(target `6a6802a`, PR #63 병합·PR CI `37725084420`).
  `v0.1.1` 발행 완료(target `7470250`, PR #65 병합·workflow_dispatch CI `37735089637`).
  `v0.1.2` 발행 완료(target `4dfd4d7`, PR #66 병합·workflow_dispatch CI `37764517117`).
  변경은 dev → main PR로 검증한다.
