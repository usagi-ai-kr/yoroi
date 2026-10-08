# 이슈 상태와 마일스톤 매핑 (2026-10-08)

- 기준: PR #28 병합 `48bdd8e`. 검증은 단위·통합 128개, BDD 25 시나리오/144 step(루트 보고).
- 종료 규칙: 완료 기준을 충족한 issue는 close한다. 미완료는 open 유지 후 사유를 댓글로 남긴다. memo는 손대지 않는다.
- 상세 목록과 근거는 이 표와 각 이슈 댓글을 따른다.

## 0.1.0 (CLI MVP, #1–#12·#18–#28, #56–#61)

| 이슈 | 상태 | 근거 또는 미완료 사유 |
| --- | --- | --- |
| #1, #2, #4–#12 | closed | 아키텍처·실행 기반·도메인·포트·수집·watch·CLI·HTTP. 완료 댓글에 파일·테스트 명시 |
| #3 | closed | 샘플 red→green 실측 댓글 후 close |
| #18–#21, #23, #24 | closed | 어댑터·조립·BDD. #18은 비공식 경로(사용자 승인), #19–21 계약 상세는 #14–#16 |
| #22 | closed | 사용자 승인 GET 계약으로 완료 조건을 갱신하고 close. 근거는 이슈 본문 |
| #25 | closed | 문서 동기화 PR #62 병합 후 close |
| #26, #27 | closed | 사람 조치 handle 완료(이전 검증 기록) |
| #56 | closed | 자동화 plan. Wiki 게시 검증 후 직접 close |
| #57 | closed | 코드·CI 자동화. PR #62 병합 후 close |
| #58 | closed | Wiki 최종 게시. 원격 master `a181ccb`, 새 clone 6페이지 동일 확인 후 close |
| #59 | closed | pretty CLI. PR #62 병합 후 close |
| #60 | closed | README 중세 유럽 기사 갑옷 이미지. PR #62 병합 후 close |
| #61 | closed | 버전 스크립트·SemVer 절차. PR #62 병합 후 close. v0.1.0 tag·Release는 PR #63 병합 후 발행 |

## 0.1.1 (계약 보강, #13–#17·#29)

- `0.1.1` milestone(#3)을 새로 만들고 0.1.0에서 이동했다(사용자 결정, 이슈마다 사유 댓글).
- 2026-10-08 계약 대조(`f8ba205`, push CI `37733082881`): #15·#16·#17은 완료 기준 충족으로 close.
- milestone #3은 open #13·#14·#29를 남긴 채 close했다. 같은 날 사용자 결정으로 해당 3건은 0.1.2로 이동했다.

| 이슈 | 상태 | 근거 또는 미완료 사유 |
| --- | --- | --- |
| #15 | closed | Codex 완료 기준 7개 충족(계약 문서·fixture·테스트) 후 close |
| #16 | closed | AGY 완료 기준 충족 후 close |
| #17 | closed | Claude 완료 기준 충족 후 close |

## 0.1.2 (남은 계약 확인, #13·#14·#29)

- 새 milestone 0.1.2(#4)로 이동했다(사용자 결정, 2026-10-08).
- v0.1.2 발행 완료(PR #66 병합 `4dfd4d7`, tag·Release, milestone #4 close)에도 이 3건은 닫지 않고 open 유지·이관 없음이다.

- 계약 판정 기준: 완료 기준마다 (a) 코드·문서·합성 테스트로 검증 가능, (b) 실계정 실측·공식 근거 필요로 나눠
  파일:줄 근거와 판정표로 댓글에 남긴다. (b)가 남으면 close하지 않고 open 유지하며 닫히는 조건을 함께 기록한다.

| 이슈 | 상태 | 근거 또는 미완료 사유 |
| --- | --- | --- |
| #13 | open | Ollama 계약 대조(f8ba205) 후 부분 충족. 429 rate limit·Retry-After는 실측·공식 근거 부재로 미확인 |
| #14 | open | OpenCode 계약 대조(f8ba205) 후 부분 충족. balance fallback 응답 필드 미실측 |
| #29 | open, handle·hold | Claude `/usage` 환경별 응답 차이 원인 미확정. 자동 경로는 GET으로 교체 |

## 0.2.0 (웹·이력 확장, #30–#55)

- 0.2.0 보류(사용자 결정 2026-10-08, 이유: 0.1.x 마무리 우선, milestone #2·#30–#55 open 유지).
- 계획 문서 [v0.2.0-plan.md](v0.2.0-plan.md).
- #30 계획과 #31–#55 구현 issue는 모두 `0.2.0` milestone이며 open 유지.

## 마일스톤 상태

- `0.1.0` (#1) closed: 31 closed, open 0.
  PR #63 병합 `6a6802a`(head `e6ffd2e`), PR CI `37725084420` success,
  [v0.1.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행.
- `0.1.1` (#3) closed(open 3·closed 4): #15–#17 closed. open #13·#14·#29는 이후 0.1.2로 이동.
  발행 완료: 버전 `0.1.1`, [v0.1.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.1)
  (target PR #65 머지 커밋 `7470250`, 머지 후 CI run `37735089637` success).
- `0.1.2` (#4) closed(open 3·closed 1): #13·#14·#29 매핑, 0.1.1에서 이동(사용자 결정 2026-10-08).
  발행 완료: [v0.1.2 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.2)
  (target PR #66 머지 커밋 `4dfd4d7`, 머지 후 CI run `37764517117` success). 이 3건은 open 유지.
- `0.2.0` (#2) open: #30–#55 매핑. 0.2.0 보류(사용자 결정 2026-10-08, 이유: 0.1.x 마무리 우선, milestone #2·#30–#55 open 유지). 패키지 버전은 0.1.2이다.
- 닫힌 issue 포함 미매핑 없음을 확인했다.

## PR #62 (병합)

- 병합 `1b3b027`. `Closes #25 #57 #59 #60 #61`로 위 이슈 5건이 closed 확인됐다.
- Wiki(#58) 게시·검증 뒤 #58·#56을 직접 close했다.

## PR #63 (병합, v0.1.0 발행)

- 병합 `6a6802a`(main), head `e6ffd2e`. PR CI `37725084420` success
  (main 트리 동일, ci.yml main push 트리거 없음).
- [v0.1.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행 후 0.1.0 milestone close.

## PR #65 (병합, v0.1.1 발행)

- 병합 `7470250`(main). 머지 후 workflow_dispatch CI run `37735089637` success.
- [v0.1.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.1) 발행 후 0.1.1 milestone close.

## PR #66 (병합, v0.1.2 발행)

- 병합 `4dfd4d7`(main, 2026-10-08T10:35:35Z), head `68bce2f`(.env 병합 로드 포함). PR CI `37763214238` success.
- 머지 후 workflow_dispatch CI run `37764517117` success. [v0.1.2 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.2) 발행 후 0.1.2 milestone close.
