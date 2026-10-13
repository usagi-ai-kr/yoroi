# 릴리스 상태와 발행 기록

- 0.4.0 이전 상세 발행 기록(v0.1.0 ~ v0.3.1) 및 과거 인증 검증 사실은 [release-history-pre040.md](release-history-pre040.md)에 보관한다.
- main 병합은 dev → main PR로만 진행한다(직접 push 금지).
- PR 머지 뒤 원격 CI 통과를 확인하고, 버전 갱신 시 `global-cli-update` 스킬과 [docs/global-install.md](global-install.md) 절차로 전역 CLI를 갱신하고 버전 일치를 확인한다.

## 0.4.0 머지 및 발행 상태 (2026-10-11)

- PR #91 병합 커밋 `4744fbc8280eab5a02ce42f28ed79555f318ea91`(main).
- main CI [run 38125929202](https://github.com/qus0in/yoroi/actions/runs/38125929202) success.
- 전역 CLI 동기화: `global 0.3.1 → 0.4.0` 갱신 완료 (`node scripts/update-global.mjs --check` exit 0, `yoroi --version` 0.4.0).
- **v0.4.0 Release 관측 및 유지**: 별도 작업에서 [v0.4.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.4.0)가 2026-10-11T08:53:27Z(17:53 KST) qus0in 계정으로 발행되었음이 확인됨(tag target: `4744fbc8280eab5a02ce42f28ed79555f318ea91`, git ls-remote 검증). 사용자 지시에 따라 v0.4.0 재발행이나 기존 tag/Release 변경을 금지한다.
- **실환경 detect 스모크 완료 및 0.4.0 마감**: 실환경 `yoroi detect` 스모크 1회(2026-10-11 19:17:56 KST, exit 0) 수행 완료, `zen:plugin-stale` 1건 관측([#77](https://github.com/qus0in/yoroi/issues/77) 근거 유지). [#89](https://github.com/qus0in/yoroi/issues/89) 및 Milestone 10(0.4.0) close 완료.

## 0.5.0 머지 및 발행 완료 (2026-10-11)

- PR [#95](https://github.com/qus0in/yoroi/pull/95) 병합 커밋 `e34f2178ad33b3a72661858a74e0d9b4db0c3d9a`(main).
- main CI [run 38132032129](https://github.com/qus0in/yoroi/actions/runs/38132032129) success.
- [v0.5.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.0) 발행 완료 (target `e34f2178ad33b3a72661858a74e0d9b4db0c3d9a`).
- 전역 CLI 0.5.0 동기화 완료.
- [#70](https://github.com/qus0in/yoroi/issues/70) close 및 Milestone 0.5.0 close 완료.
- 검증 기준은 OpenRouter와 Cognition 2소스다(유효 metric 각 1,530건, Cognition 탈락 20행 부분 수집). 네 소스 E2E 완전 통과는 주장하지 않는다.
- Arena·Artificial Analysis는 단일 요청 예산(`maxRequests=1`)에서 페이지 완전성 실패였다. 4소스 코드 지원은 유지하고 [#92](https://github.com/qus0in/yoroi/issues/92)(Arena)·[#93](https://github.com/qus0in/yoroi/issues/93)(AA)로 분리했다.
- 완료 기준 5·6(Hermes 매일 실행·전달 검증, 운영 문서화)은 [#94](https://github.com/qus0in/yoroi/issues/94)로 분리하고 [#92](https://github.com/qus0in/yoroi/issues/92)·[#93](https://github.com/qus0in/yoroi/issues/93)과 함께 [0.5.1](https://github.com/qus0in/yoroi/milestone/11)에 배정했다(2026-10-11 사용자 결정).
## 0.5.1 머지 및 발행 완료 (2026-10-11)

- PR [#98](https://github.com/qus0in/yoroi/pull/98) 병합 커밋 `2536baa69f88647a9ef75704bb4ee3729e248b11`(main).
- main CI [run 38141050373](https://github.com/qus0in/yoroi/actions/runs/38141050373) success.
- [v0.5.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.1) 발행 완료 (tag `v0.5.1`).
- 전역 CLI 0.5.1 동기화 완료 (`yoroi --version` 0.5.1 일치).
- OpenCode 플러그인 재설치 installed 완료 (운영 반영은 사용자 OpenCode 재시작 대기).
- [#92](https://github.com/qus0in/yoroi/issues/92)·[#93](https://github.com/qus0in/yoroi/issues/93)·[#96](https://github.com/qus0in/yoroi/issues/96)·[#97](https://github.com/qus0in/yoroi/issues/97) close 및 [Milestone 0.5.1](https://github.com/qus0in/yoroi/milestone/11) close 완료.
- 0.6.0 착수: [#94](https://github.com/qus0in/yoroi/issues/94) 레터 이슈 발행, [#84](https://github.com/qus0in/yoroi/issues/84) trend 착수.

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

## 0.8.1 발행 및 0.8.2 준비 (2026-10-13)

- v0.8.1 발행 완료: PR #112 → main `57b379d`, main CI [38247171932](https://github.com/qus0in/yoroi/actions/runs/38247171932) attempt 2 success, [v0.8.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.1), 전역 CLI 0.8.1.
- 0.8.2 milestone: [#113](https://github.com/qus0in/yoroi/issues/113) 레터 종합 스코어 정렬 및 사용자 피드백 4건, 재오픈한 [#107](https://github.com/qus0in/yoroi/issues/107) SQLite WAL 첫 열기 재시도 수정.
- 0.8.2는 위 두 이슈를 묶어 dev → main PR 준비 중이다.

## 0.8.2 발행 및 0.8.3 준비 (2026-10-13)

- v0.8.2 발행 완료: PR #114 → main `e631228`, PR/push CI 1회 성공, main CI [38324791859](https://github.com/qus0in/yoroi/actions/runs/38324791859) attempt 1 success, [v0.8.2 Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.2).
- 전역 CLI 0.8.2는 `v0.8.2` 태그 worktree에서 설치했다. #113·#107 close 및 0.8.2 milestone close 완료.
- 0.8.3 milestone: [#116](https://github.com/qus0in/yoroi/issues/116) Antigravity 요금제 추가. `plan-catalog.ts` 구현은 go1 진행 중이며, 0.8.3 dev → main PR을 준비한다.
- 0.8.3 범위 확장: [#117](https://github.com/qus0in/yoroi/issues/117) Top10 10행 채움·Free 티어 섹션·표시 안내/이모지·Cursor 요금제·Cognition 1.1·AA FrontierCode 대비·Grok/Kimi 롤백을 추가한다.

## 0.8.3 발행 및 0.8.4 준비 (2026-10-13)

- v0.8.3 발행 완료: PR #120 → main `81b264c`, PR CI 1회 성공, main CI [38332564117](https://github.com/qus0in/yoroi/actions/runs/38332564117) attempt 1 success, [v0.8.3 Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.3), 전역 CLI 0.8.3.
- 실수집 status는 `all_healthy`로 Cognition 부분 수집 경고가 해소됐다. #116·#117 close 및 0.8.3 milestone close 완료.
- 0.8.4 milestone: [#121](https://github.com/qus0in/yoroi/issues/121) Cursor 접근 표기 단순화, 구현 go1 진행 중; dev → main PR 준비.

## 0.8.4 발행 및 0.8.5 준비 (2026-10-13)

- v0.8.4 발행 완료: PR #122 → main `73f4ad1`, PR/main CI [38336083878](https://github.com/qus0in/yoroi/actions/runs/38336083878) attempt 1 success, [v0.8.4 Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.4), 전역 CLI 0.8.4.
- #115 본문 갱신(2026-10-13 11:19:10 KST), #121·0.8.4 milestone close 완료.
- 0.8.5 milestone: [#123](https://github.com/qus0in/yoroi/issues/123) 레터 정정 8건을 묶어 dev → main PR 준비.
- 후속 상태 갱신 (2026-10-13): v0.8.5 발행 완료(PR #124 → main `240378b`, PR/main CI [38344750752](https://github.com/qus0in/yoroi/actions/runs/38344750752) attempt 1 success, [Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.5), 전역 CLI 0.8.5); #115 본문 갱신(13:07:28 KST), #123·0.8.5 milestone close. 0.8.6 milestone: [#125](https://github.com/qus0in/yoroi/issues/125) 레터 발행을 Hermes 크론에서 yoroi 자체 PM2로 이관하고 `insights publish` 추가 — v0.8.6 발행 완료(PR #126 → main, PR/main CI success, [v0.8.6 Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.6), 전역 CLI 0.8.6, #125 close). 0.9.0 범위: MiMo 구세대 세대 제외·접근 요금제 별도 표·SQLite 전량 적재 후 재조회·Arena 수집 제거·혼합 단가 $3 상한·AA 미측정 근거 유지·역할 재정립 — 상태 dev 미커밋·PR 대기.

## 버전 이력 요약

- **0.1.0**–**0.1.2** (2026-10-08): MVP, CLI 개선, .env 병합 로드 완료 및 발행.
- **0.2.0** (2026-10-10): OpenCode Zen Free 락([#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76)), [v0.2.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.2.0) 발행 완료(2026-10-10T10:38:55Z).
- **0.3.0** (2026-10-11): 60초 SQLite 캐시·이력([#71](https://github.com/qus0in/yoroi/issues/71)), watch 제거([#83](https://github.com/qus0in/yoroi/issues/83)). [v0.3.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.3.0) 발행 완료.
- **0.3.1** (2026-10-11): Zen Free 로드 표시([#77](https://github.com/qus0in/yoroi/issues/77)), 전역 0.3.1 동기화, [v0.3.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.3.1) 발행 완료. 실관측은 [#88](https://github.com/qus0in/yoroi/issues/88)로 분리.
- **0.4.0** (2026-10-11): 내장 10분 주기 감지기(#89) PR #91 머지 완료, 전역 0.4.0 동기화 완료. 외부 작업으로 [v0.4.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.4.0) 발행 완료 관측.
- **0.5.0** (2026-10-11): 크롤러 2소스 검증(#70) PR #95 머지 완료, [v0.5.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.0) 발행 완료, 전역 0.5.0 동기화 완료.
- **0.5.1** (2026-10-11): Arena·AA top20(#92·#93), Zen 리셋/남은시간(#96), OpenCode 락 복구(#97) PR #98 머지 완료, [v0.5.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.1) 발행 완료, 전역 0.5.1 동기화 완료.
- **0.6.0** (2026-10-12 발행 완료): trend 24h·7d(#84), Top50 수집·Top10 압축 레터(#94, #99·#100), 크론 자동 발행, #77·#88 해제 실관측 반영.
