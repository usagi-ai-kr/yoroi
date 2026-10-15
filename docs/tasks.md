# 로컬 작업 기록 (현재 운영 현황)

- 원격이 없거나 외부 기록이 허가되지 않은 작업은 여기에 기록한다.
- 0.4.0 이전 과거 상세 기록과 이전 운영 상태는 [tasks-pre040.md](tasks-pre040.md) 및 [tasks-archive.md](tasks-archive.md)에 보관한다.
- main에 직접 push하지 않는다. 모든 변경은 dev → main PR로 병합한다.

## 현재 상태 (2026-10-14)

- 0.4.0~0.11.1 발행 완료(PR #91·95·98·101·106·109·112·114·120·122·124·126·128·130·139·143 → main, 전역 CLI 동기화, 이슈·milestone close). 상세 발행 기록은 [release-status.md](release-status.md)에 둔다.

- PR #101 머지(`ae7cd83`), main CI [38203425496](https://github.com/qus0in/yoroi/actions/runs/38203425496): attempt1은 `tests/cli-process.test.ts` 3000ms flaky 실패, attempt2 success. [v0.6.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.6.0) 발행 완료.
- 전역 CLI 0.6.0은 `v0.6.0` 태그 worktree에서 설치했다. #84·#77·#88 및 0.3.1 milestone close 완료. 0.6.0 milestone은 #94 크론 관측 대기로 open 유지.
- release-prep-070: 버전·준비 문서 갱신, 이력 보존 및 삭제 줄 감사 후 `pnpm run check`·레포 검증·diff 검사로 확인한다. 외부 호출·커밋 없이 로컬 기록만 수행한다.

## 남은 작업

- 0.6.0 milestone(9): #94 크론 관측 대기로 open 유지.
- 0.7.0 milestone: #102 OpenCode Data 내부 참조 수집(dailyTokens 파서·리더보드 키 진단), #103 순위 규칙, #104 요금제상 최적, #105 `--markdown`을 묶어 dev → main PR 준비.
- #102 크롤러 작업·진단 완료. 리더보드 파서는 내일 진단 결과 후 진행한다(승계 작업 없음).
- 크론 출력은 0.6.0부터 `--pretty` 압축 Top10, 0.7.0부터 `--markdown`이다.
- [#29](https://github.com/qus0in/yoroi/issues/29): 0.1.2 milestone(#4)에 open·hold 유지.
- PR #86 후속(미착수): 토큰 갱신 이력 끊김(`n/a: no-previous`와 구분) 표시. 계정 다이제스트 값은 출력·로그에 미노출.

## 소유표 (2026-10-14 p61·p62 배정 현황)

| pane | 모델 | 역할 및 담당 | 상태 |
| --- | --- | --- | --- |
| w12:pR | o agy Claude Opus 5.5 Medium (2026-10-14 o 인계) | 오케스트레이터(분배·리뷰만) | 가동 중 |
| w12:p0 | w2 OpenCode DeepSeek V4.1 Flash max | 워커 (p61 w4 감사·p62 coord CLI 구현) | 가동 중 |
| w12:p11 | w3 OpenCode Cat Jam Free max | 워커 (p61 종합 최종화·p62 규칙 문서) | 가동 중 |
| w12:pV | w4 OpenCode MiMo V2.6 Flash Free | 워커 (p61 감사·w4b 주보고·p62 검증) | 가동 중 |

- 같은 파일을 두 pane에 동시에 배정하지 않는다. 배정 상세 원본은 worker-dispatch.md(p61 재분배)·coord-cli.md(p62), 이전 구현 소유·병합 기록은 tasks-pre040.md·tasks-archive.md·issue-status.md에 있다. w1·w12:p12는 p61 테이블 미배정(p12 모델 미확인 보류).

## 이슈·마일스톤 매핑

- `0.1.0`–`0.1.2`: v0.1.0·v0.1.1·v0.1.2 발행 완료 (milestone close, #29 hold).
- `0.2.0`: [#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76) 검증 후 [v0.2.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.2.0) 발행 완료.
- `0.3.0`: [#71](https://github.com/qus0in/yoroi/issues/71) 반영, [v0.3.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.3.0) 발행 완료 (`f12f55a`).
- `0.3.1`: [#77](https://github.com/qus0in/yoroi/issues/77) 로드 표시, [v0.3.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.3.1) 발행 완료 (`56413de`).
- `0.4.0`: [#89](https://github.com/qus0in/yoroi/issues/89) 감지 (스모크 exit 0 확인, #89 close, milestone 10 close, [v0.4.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.4.0) 발행 완료).
- `0.5.0`: [#70](https://github.com/qus0in/yoroi/issues/70) 인사이트 레터 (PR #95 머지 e34f217, [v0.5.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.0) 발행, 전역 CLI 갱신, #70 close, milestone 7 close).
- `0.5.1`: milestone 11 ([#92](https://github.com/qus0in/yoroi/issues/92)·[#93](https://github.com/qus0in/yoroi/issues/93) top20, [#96](https://github.com/qus0in/yoroi/issues/96) Zen 리셋/남은시간, [#97](https://github.com/qus0in/yoroi/issues/97) OpenCode 락 복구, PR #98 머지 2536baa, [v0.5.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.1) 발행 완료, #92·#93·#96·#97 close, milestone 11 close).
- `0.6.0`: milestone 9 ([#84](https://github.com/qus0in/yoroi/issues/84) trend 24h·7d 병행, Top50 수집·Top10 압축 레터, [#94](https://github.com/qus0in/yoroi/issues/94) 레터 #99·#100 발행 및 크론 2종 등록, [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88) 해제 실관측으로 close 완료, #84 close, PR #101 머지 ae7cd83 및 v0.6.0 발행, milestone은 #94 크론 관측 대기로 open).
- `0.7.0`: #102·#103·#104·#105 milestone, 버전 0.7.0 및 dev → main PR 준비.

## 0.8.1 발행 및 0.8.2 준비 (2026-10-13)

- v0.8.1 발행: PR #112 → main `57b379d`, main CI 38247171932 attempt 2 success, [Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.1), 전역 CLI 0.8.1.
- 0.8.2 milestone: [#113](https://github.com/qus0in/yoroi/issues/113) 레터 종합 스코어 정렬·피드백 4건 + 재오픈 [#107](https://github.com/qus0in/yoroi/issues/107) SQLite WAL 첫 열기 재시도 수정. dev → main PR 준비 중.

## 0.8.2 발행 및 0.8.3 준비 (2026-10-13)

- v0.8.2 발행 완료: PR #114 → main `e631228`, PR/push CI 1회 성공, main CI 38324791859 attempt 1 success, [v0.8.2 Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.2), 전역 CLI 0.8.2 태그 worktree 설치.
- #113·#107 close 및 0.8.2 milestone close 완료.
- 0.8.3: [#116](https://github.com/qus0in/yoroi/issues/116) Antigravity 요금제 추가, `plan-catalog.ts` 구현 go1 진행 중; dev → main PR 준비 범위.
- 0.8.3 범위 확장: [#117](https://github.com/qus0in/yoroi/issues/117) Top10 10행 채움·Free 티어 섹션·표시 안내/이모지·Cursor 요금제·Cognition 1.1·AA FrontierCode 대비·Grok/Kimi 롤백을 추가한다.

## 0.8.3 발행 및 0.8.4 준비 (2026-10-13)

- v0.8.3 발행: PR #120 → main `81b264c`, PR CI 1회 성공, main CI 38332564117 attempt 1 success, [Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.3), 전역 CLI 0.8.3.
- 실수집 status `all_healthy`로 Cognition 부분 수집 경고 해소; #116·#117 close 및 0.8.3 milestone close.
- 0.8.4: [#121](https://github.com/qus0in/yoroi/issues/121) Cursor 접근 표기 단순화, 구현 go1 진행 중; dev → main PR 준비.
- v0.8.4 발행: PR #122 → main `73f4ad1`, PR/main CI 38336083878 attempt 1 success, [Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.4), 전역 CLI 0.8.4.
- #115 본문 갱신(2026-10-13 11:19:10 KST), #121·0.8.4 milestone close 완료.
- 0.8.5 준비: [#123](https://github.com/qus0in/yoroi/issues/123) 레터 정정 8건, dev → main PR.

## 0.8.5 발행 및 0.8.6 준비 (2026-10-13)

- v0.8.5 발행 완료: PR #124 → main `240378b`, PR/main CI [38344750752](https://github.com/qus0in/yoroi/actions/runs/38344750752) attempt 1 success, [Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.5), 전역 CLI 0.8.5.
- #115 본문 갱신(2026-10-13 13:07:28 KST), #123·0.8.5 milestone close 완료.
- 0.8.6 범위: [#125](https://github.com/qus0in/yoroi/issues/125) 레터 발행을 Hermes 크론에서 yoroi 자체 PM2로 이관하고 `insights publish` 명령 추가; dev → main PR 준비.

## o2 모델 교체·AA 미측정 근거 유지 (2026-10-13, o2 수행)

- o2 모델을 GLM-5.3-Flash(Ollama Cloud)로 교체(사용자 지시, 직전 Codex GPT-6.1-Sol capacity 오류 보고 뒤). orchestration.md 반영.
- 혼합 단가 $3 상한 폐지(2026-10-13 사용자 지시): 도입했던 단가 상한 제외 규칙·관련 문서를 걷어냈다(p45).
- AA 미측정 요구도 같은 흐름으로 반영(unmeasured-evidence): OpenRouter·OpenCode tokens 근거 행 있으면 후보 풀 유지, usage 폴백. 풀 184→208, 두 역할 Top10 10행 유지. 상세는 [top10-unmeasured-evidence.md](insights/top10-unmeasured-evidence.md).
- 검증: 내 범위 유닛(top10·letter·run-once 전파 테스트) 전수 통과, BDD 41/41, typecheck·build 통과. 전체 스위트는 o1의 arena 제외 작업(2026-10-13 동시 진행, sources.ts·registry 테스트 갱신 대기) 일부 실패가 섞여 전수 녹색 미확정 — 내 변경 파일과 무관(격리 실행 확인).

## 레터 데이터·표시 정정 (2026-10-13, 미발행)

- 요청 3건 반영: 워커 후보 기준/MiMo 2.5 구세대 제외(등록 라인 `mimo-v2`의 신세대 등급이 있으면 무등급 구세대 제외), 접근 요금제를 Top10 두 표에서 분리해 워커 표 뒤 별도 `## 접근 요금제` 표(두 목록 unique 모델 × 보유 요금제, ☑/☐)로 표시, AA 등 소스 전량 SQLite 적재 후 같은 키 재조회 렌더(저장값만 사용).
- 사용자 결정: Arena 수집 제외(스코어 입력이 아니어서 순위 변화 없음, sources 배지 5→4), "kimi-k2-7-code와 kimk-k3는 다른 계열로 봄"(원문 오기 그대로 기록, 코드 식별자는 `kimi-k3`) — Kimi 분리는 기존 동작과 같아 코드 변경 없음.
- o2 별도 작업(AA 미측정 근거 유지) 결과도 같은 워킹트리에 함께 있으며, 근거 규칙 상세는 [top10-unmeasured-evidence.md](insights/top10-unmeasured-evidence.md)만 본다(중복 기록 없음).
- 검증: 단위 879/879, BDD 41/41, typecheck·build·validate-repo PASS. 실수집 DB 사본 렌더 `insights once --markdown` exit 0, 근거 산출은 레터 Top10과 일치 확인(근거: scratch/reports/yoroi-final-report.md). 버전·PR·발행은 0.9.0(미커밋) 예정, 사용자 승인 대기하며 dev 워킹트리에만 보관.
- Arena 소스 완전 제거(2026-10-13 사용자 지시, o2): `InsightSource`·기본 schema/scope/rank 설정·검증 분기·`hf-rows` 파이프라인 삭제, 테스트 fixture는 날짜형 OpenRouter(`metadata.date`)로 교체, `arena-transport.md` 삭제. 과거 릴리스·조사 기록의 Arena 언급은 역사로 유지.
- 레터 표시 변경(2026-10-13 사용자 지시, o2): 파레토 최적을 독립 `파레토` 열 `👍`로(구 `⭐ 순위`), 교집합 `↔` 제거, 접근 요금제 체크리스트 표(`letter-markdown-access.ts`) 삭제, AA 미측정 free 모델은 Free 두 역할 표 끝 `AA 미측정` 행으로 포함.
## p54 승인 C 통합·p55 후속 (2026-10-14, 커밋 금지)
- p54 완료(보고 scratch/reports/yoroi-worker-cognition-openrouter.md): 오케75/10/5/10+effort 일관, 워커30/20/10/40+AA API가격·tok/s+성능 하한.70(전체풀 정규화 후). 재분배(o=pW): w3(pR)코어 완료·리뷰 / w1(pS)배선·표시·기존테스트(top10-unified·rank·unmeasured는 w3 이관) / w2(pQ)통합검증·독립참조·docs / w4(pV)순위 교차대조 / o 최종 보고. `scratch/packets/p54-o-dispatch.md`. p55 완료(917/917, 보고 동일 파일): w3 SQLite 잠금 경합(코드 쪽) / w2 오케 가중치 80/15/2.5/2.5 분석·반영 / w1 가중치 테스트 후속 / w4 사용량 limit 표시 / o 결정·보고. `scratch/packets/p55-dispatch.md`. p56 완료(919/919): w4 limit 98% / w3 오케 가성비 I²/P·사용량 제거 코어·최종검증 / w2 가중치 90/0/2.5/7.5 분석·참조·docs / w1 표시·테스트. `scratch/packets/p56-dispatch.md`. p58 후속 통합 완료: 오케 P1 95/0/2.5/2.5·전 effort 변형 점수 최고 대표(동점 낮은 effort, medium 고정 취소), 독립 참조/계약 docs 정정, 두 GPT Sol 독립·effort successor 표시 보호. integration_audit=통합 검증·contract_audit=참조/docs·ranking_audit=순위/식별·root=리뷰/기록. 전체 unit931/931·BDD41/41·typecheck/build·validate 통과, 실입력 오케40/워커18 후보 독립 비교 불일치0. 6.1 Sol 워커 순위는 옵션 누락을 바로잡아14위로 정정. Arena 설계·p59 권고는 결정 대기, 커밋 없음. `scratch/packets/continuation-dispatch.md`. p60 실제 워커 재배정: w1=pR(Sonnet High) 판단종합, w2=p0(DeepSeek max) 독립판단/분리검증, w3=p11(Cat Jam max) 레터, w4=pV(MiMo Flash) 민감도. list/visible 재확인·전원idle, 상세 docs/insights/worker-dispatch.md. 사용자 요청으로 o→agy w12:pR(Opus5.5 Medium) 인계. w2/w3/w4 보고 도착, 종합 최종화·감사·기록은 새 o가 재분배. scratch/packets/yoroi-p60-agy-handoff.md. p61 완료: w3 종합 최종화(p60-w1-synthesis v2, Sol 분리 경고 해제)·w2 p60-w4 감사·w4 p60 w1/w2/w3 감사(미신고 top10-unified 테스트는 기존 변경 판정, successor 지정 3파일 25/25+tsc clean)·w4b 주 보고 append·tasks 갱신. p62 배정 원본은 docs/insights/coord-cli.md(w2 coord.py 구현, w3 규칙 문서, w4 독립 검증·리뷰).
- p72-w1a: 묶음 6 문서 4개만 커밋 준비(architecture·development·tasks·opencode-v2-migration). 표시/V2 관련 fake 테스트 18/18·레포 검증 PASS, push 없음. 기존 회고 재사용으로 새 스킬 없음.

## 0.12.0 준비 (2026-10-15)

- [PR #148](https://github.com/qus0in/yoroi/pull/148)(dev→main) 범위: Free publish 가드(#144)·AA partial fallback·xAI 기본 공급자(#132 → #119)·Cursor Plus(#119)·워커 규칙(.30/.20/.10/.40·존 .60·p75 상향·$5/M 상한)·yo 필터(under·n/a·optimal)·`--pretty --full`·zen Reset 추정.
- 사용자 결정(2026-10-15): D 없이 릴리스. D는 #147(0.13.0·milestone 24)로 분리하고 실행 확인 뒤 1.0.0.
- 완료: PR #148 머지(main `baae51b`)·main CI success(run `38668219318`)·tag `v0.12.0`·Release 발행·전역 CLI 0.12.0·milestone 22 close·#119 종료. PR 초안은 scratch/reports/yoroi-m012-release-update.md.
- 0.12.1 준비(patch, 미발행·머지 대기): xai 기본 제외·기본 5복원, yo 기본(limit·under·optimal·over 표시·n/a 숨김)·yo2/plain 전체 표시 유지, 명시 선택 opt-in 호환, 이전 운영 정리 `91c1d71` 동봉. D는 #147(0.13.0) 유지.
- 0.13.0 준비(minor, 미발행·머지 대기): `34e6eb5` xAI billing 주간 수집·`b8ef7b1`/`d30f6ee` Zen V2 판정/해제, PR #150 머지(`ec8c4f4`)·버전 승격 0.13.0(`v0.13.0` tag 예정)·tag·Release·milestone close 미수행. #147(웹 풀 일치 비교 남아) open 유지, 위키 #151 별도.
- 0.12.0 회고(2026-10-15): 리뷰 통과분은 사용자 지시에 따라 요청 없이도 작업 단위별로 묶어 커밋한다(파일 지정 add·묶음 계획 선행·동시 착륙 파일 제외). 튜닝은 scratch 시뮬레이터로 기준선 줄 단위 일치와 이웃 안정성을 먼저 확인하고 사용자 확정값만 코드에 반영한다.
