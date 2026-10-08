# CLI 이슈 검토·분배 결과 (2026-10-07)

원격 열린 이슈 #1–25를 읽고 `memo` 대상이 없는 것을 확인했다.
구현 완료는 아래 검증 기준이다. 변경은 dev → main PR로 게시하며 원격 이슈는 종료하지 않았다.

## 담당과 단위

- Orchestrator/Codex (`wX:p1`): #1 #4–9 #12 #15 #20, 조립·검증·문서 통합.
- worker1/AGY (`wX:p2`): #13 #14 #16 #17 계약 조사·보완, 공통 경계 읽기 전용 리뷰.
- worker2/OpenCode (`wX:p3`): #2 #3 실행/테스트 기반 → #10 #11 #24 CLI/BDD.
- 같은 파일에 동시 쓰기하지 않고 첫 단위 검증 후 후속 단위를 배정했다.
- 사용자 경로 보완 후: worker1은 AGY/Claude 계약·어댑터, worker2는 OpenCode 계약·어댑터와
  실제 5개 어댑터 BDD, orchestrator는 Ollama 서명 API·설정·조립·통합을 담당했다.

## 결과와 의존성

| 이슈 | 현재 결과 | 완료/후속 기준 |
| --- | --- | --- |
| #1 | 아키텍처·의존 방향 정의 및 검사 구현 | `docs/architecture.md`, import 경계 테스트 |
| #2–3 | TypeScript 실행·빌드·TDD/BDD·CI 정의 구현 | Node/npm 고정, 로컬 check 통과 |
| #4–5 | 도메인·UsageSource·정규화 오류 구현 | 불변조건 및 성공/실패 테스트 |
| #6 | 프로세스 실행·JSONL handshake·timeout/cancel | fake child 테스트, shell 비사용 |
| #7 | 환경 설정·공급자 선택·credential·timeout | 잘못된 설정은 조회 전에 실패 |
| #8–9 | 단발 부분 실패 격리·60초 반복·취소 | fake source/scheduler 테스트 |
| #10–11 | once/watch·렌더러·종료 signal 구현 | 성공/실패/interval/cleanup 단위·BDD |
| #12 | HTTP 경계·timeout·오류 정규화 구현 | fake fetch 테스트, 민감 헤더 비노출 |
| #13–14 | Ollama 비공식 서명 API·OpenCode 공식 Go API 계약 확인 | pinned OpenUsage 및 공식 route 근거 |
| #15 | Codex 공식 app-server 읽기 계약 및 합성 fixture | 공식 문서·파서 검사, 실제 조회 성공 |
| #16–17 | 두 CLI `-p /usage` 직접 실행·출력 구조 확인 | AGY TSV 및 Claude 평문 계약 |
| #18–19 | Ollama/OpenCode HTTP 어댑터 구현·실제 조회 성공 | 현재 Ollama 집계/잔액 7개 창, OpenCode 3개 창 |
| #20 | Codex UsageSource 구현·fake process 검증 | usedPercent/reset/bucket·형식 변경·오류 검사 |
| #21–22 | AGY/Claude process 어댑터 구현 | 실제 조회 성공: 창 4개/2개, 개인 수치 기록 없음 |
| #23 | 다섯 실제 어댑터 기본 registry 연결 | 설정·credential·timeout·선택 순서 검사 |
| #24 | 실제 5개 어댑터의 경계 fake BDD 추가 | 전체 성공·HTTP/CLI 실패 격리·watch 종료 검사 |
| #25 | 현재 실행·아키텍처·제약·로드맵 동기화 | 전체 MVP 완료로 표시하지 않음 |

## 검증과 기록

- 단위/통합·BDD·빌드·타입 검사 및 레포 검사 결과는 `docs/tasks.md`에 기록한다.
- 다섯 공급자 실제 조회 성공을 확인했다. 개인 수치·응답·키 원문은 기록하지 않는다.
  실계정 smoke와 fake 경계 BDD 검증은 각각 기록한다.
- 최초 GitHub 댓글 게시는 자동 승인 검토에서 거부되었다.
  사유: 이번 요청은 검토·분배 허가이며 외부 진행 기록 게시의 명시 허가가 없다고 판단했다.
  이후 사용자의 명시 게시 승인으로 #1–25에 이슈별 결과·대기 사유 댓글을 게시했다.
- [#1 종합 댓글](https://github.com/qus0in/yoroi/issues/1#issuecomment-6040151550).
  총 25개 댓글의 원격 본문·대상 이슈를 재조회해 확인했다. 이슈 상태·라벨은 변경하지 않았다.
- 경로 재검증 후 #1 #7 #13–25에 [정정 댓글](https://github.com/qus0in/yoroi/issues/1#issuecomment-6040486723)
  15개를 게시하고 본문·대상을 확인했다. 과거 보류 판단은 최신 댓글로 정정했다.

## 사람 조치 (2026-10-08)

- [#26 Ollama 서명 키·실행 계정 인증 설정](https://github.com/qus0in/yoroi/issues/26): `handle`, `hold`.
- [#27 OpenCode Go API 키 실행 환경 설정](https://github.com/qus0in/yoroi/issues/27): `handle`, `hold`.
- 두 건 모두 사용자 설정 후 실계정 조회 성공을 확인했다. 키 값은 이슈에서 받지 않았다.
- 본문 수정·hold 해제·댓글·종료는 자동 승인 검토에서 확인 요청 범위 초과로 거부되어 유지했다.

## 회고

- 바이너리의 명령 이름·옵션 문자열만으로 모델 호출 없는 실행 경로를 단정할 수 없다.
- 실제 조회 계약 없이 만든 가상 공급자 출력은 adapter fixture로 사용하지 않는다.
- worker 산출물은 검증 범위와 근거를 확인하고, 잘못된 완료 판단을 통합 전에 바로잡는다.
- 공식 문서에 없다는 이유만으로 조회 경로가 없다고 결론내리지 않는다.
  사용자 제공 CLI·참조 구현을 검증하고, 허용된 비공식 계약은 별도로 표시한다.
- 서버/호스트에서 로컬 CLI를 실행하는 구조를 기준으로 설치·로그인·키 권한을 확인한다.
- 리뷰 후 interval 상한·종료 중 최초 오류 보존·UTF-8 청크·출력 제한·종료 대기 hang을 수정했다.
- Codex percent finite/범위 검증은 domain에서 이미 적용된다. 중복 검증 제안은 결함으로 세지 않았다.
- 일회성 자식 객체의 종료된 listener는 GC 대상이다. 재사용 fake의 listener 누수 가설은 별도 변경하지 않았다.
