# 로컬 작업 기록

원격이 없거나 외부 기록이 허가되지 않은 작업은 여기에 기록한다.
GitHub 이슈로 이전하면 링크를 남기고 상세 기록은 이슈에서 이어간다.

## 2026-10-07 — 프로젝트 관리 초기 구성

- 요청: `../qketing`을 참고해 에이전트 룰·스킬·레포 관리 구성.
- 범위: AGENTS/Claude 공유, 스킬 3개, 문서, GitHub 템플릿·라벨·CI, 로컬 검증.
- 완료 기준: 스킬·레포 검증 통과, 공유 링크 정상, 작성 파일 100줄 이하.
- 결정: 기술 스택·배포·Herdr 설정은 현재 범위에서 필요하지 않아 가져오지 않는다.
- 초기 제약: `.agents/`와 `.git/` 쓰기 차단으로 임시 `skills/` 경로를 사용했다.
  권한 조정 후 `.agents/skills/`로 이전하고 로컬 Git을 main으로 초기화했다.
- 회고: 초기 저장소는 신규 파일도 검사하고 Git 초기화 없이 검증할 수 있어야 한다.
  문서·스킬만 바뀌어도 CI를 실행해 관리 규칙을 확인한다.
- 검증: 레포 검사 23개 파일·3개 스킬 통과, 공식 skill-creator 구조 검사 3개 통과.
- 검증: 잘못된 frontmatter·없는 참조·100줄 초과(마지막 개행 없음 포함)·끊어진 링크를
  거부하는지 확인했다. Markdown 링크·CI YAML/트리거·README 보존도 확인했다.
- 검증 범위: 로컬 실행만 확인했다. GitHub CI 실행과 브랜치 보호 적용은 원격 연결 후 확인한다.
- 후속 작업: 관리 라벨·보호 설정, 제품 범위·기술 스택 결정.

## 권한 조정 후 정리

- 스킬 3개 원본을 `.agents/skills/`로 이동하고 Claude 공유 링크를 갱신했다.
- AGENTS·문서·검증 스크립트의 경로를 새 원본에 맞췄다.
- Git은 main으로 초기화했으며 커밋과 원격 연결은 별도 요청 시 수행한다.
- 검증: 이전 후 23개 파일·3개 스킬 검사 통과. 공유 링크·Markdown 링크·main 브랜치 확인.
- 권한: 일반 샌드박스에서는 제한이 남아 있어 승인된 권한 상승 실행으로 이전·초기화했다.

## 원격 최초 게시

- 요청: 원격 푸시. 레포 규칙에 따라 회고와 초기 커밋을 포함한다.
- 대상: `origin` → `https://github.com/qus0in/yoroi.git`, 원격은 빈 상태로 확인했다.
- 방식: 최초 main 게시 후 같은 커밋의 dev를 게시하고 로컬 작업 브랜치는 dev로 둔다.
- 검증: 게시 전 23개 파일·3개 스킬 검사 통과. 원격 SHA와 dev CI 결과는 게시 후 확인한다.
- 회고: 제한된 네트워크에서 gh 인증 실패가 보이면 네트워크 허용 실행으로 먼저 재확인한다.
  이번 확인에서는 기존 인증이 정상이며 재로그인은 필요하지 않았다.

## 2026-10-07 — Herdr 워크스페이스 현황 확인

- 읽기 전용 CLI 조회: yoroi(wX) 3탭·3패널, qketing(wW) 5탭·5패널.
- yoroi: Codex 작업 중, Antigravity·OpenCode 대기. qketing: 셸 1개·OpenCode 대기 4개.
- 서버/클라이언트 0.9.3 stable, 프로토콜 호환·재시작 불필요 확인.
- 회고: `pane current --current`는 이 호출 환경에서 wW:p5를 반환했지만 포커스는 wX:p1이다.
  현재 대화 패널은 cwd·포커스·제목과 함께 식별하고, 조회에는 명시적 workspace/pane ID를 쓴다.
- 검증: workspace/tab/pane/agent 목록 및 화면 대조. 패널 입력·이름·구성 변경 없음.

## 2026-10-07 — GitHub 원격 라벨 적용

- 요청: `qus0in/yoroi` 원격에 `.github/labels.json` 9개 라벨 생성 및 기본 라벨 10개 삭제.
- 결과: 관리 라벨 9개 생성 및 기본 라벨 10개 삭제 완료. 이름·색상·설명 일치 검증 완료.
- 회고: 사용자 명시 지시는 스킬의 기존 라벨 보존 규칙보다 우선한다.
  적용 후에는 로컬 정의 파일과 원격 목록의 이름·색상·설명 일치를 검증한다.
- 검증: orchestrator가 원격 9개 라벨 일치 검증, `docs/github.md` 상태 갱신.

## 2026-10-07 — CLI 이슈 검토·분배 및 로컬 구현

- 요청: 원격 열린 이슈 #1–25 검토 후 나눠 진행. 분배·이슈별 결과는 [issue-status.md](issue-status.md).
- worker1: 4개 공급자 계약 조사·근거 보완·경계 리뷰. worker2: TS/TDD/BDD 기반·CLI·수용 테스트.
- orchestrator: domain/app/process/HTTP/config/Codex 구현, 조립·문서·통합 검증.
- 확인된 Codex 조회만 실제 어댑터로 구현. 나머지 4개는 계약 미확정으로 unavailable 처리.
- 검증: check(typecheck·단위/통합 49개·BDD 13시나리오/63step·build), 레포 검사·문서 링크 검사 통과.
- 실행: dev 및 빌드 help, 실제 CLI 진입점의 미설치 exit 1·SIGINT/SIGTERM 정상 종료 검증.
  공급자 계정·네트워크는 호출하지 않았다. CI 정의만 추가했으며 새 원격 CI는 미실행이다.
- 회고: 실제 계약 없는 fixture를 만들지 않고 source fake BDD와 실제 연동 완료를 구분한다.
  제한된 샌드박스에서는 tsx CLI 대신 node --import tsx로 dev/test를 실행한다.
- 리뷰 회귀 검증: 주기 상한·최초 오류 보존·UTF-8 청크·출력 제한·종료 hang 수정.
- 외부 기록: GitHub 댓글은 명시 게시 허가가 없다는 자동 승인 검토 사유로 거부되어 로컬 기록으로 대체.
- 커밋·push·README/AGENTS 수정 없음. 기존 docs/github·docs/tasks 변경 보존.

## 2026-10-07 — 이슈 진행 댓글 게시

- 요청: `우선 댓글 올리기.` 명시 승인에 따라 기존 #1–25에 결과·검증·대기 사유 댓글을 게시했다.
- [종합 기록](https://github.com/qus0in/yoroi/issues/1#issuecomment-6040151550), 상세는 각 이슈 댓글.
- 검증: 25개 댓글의 원격 본문이 준비한 초안과 일치하고 대상 이슈도 맞는지 재조회했다.
- 범위: 로컬 미커밋 코드 기준임을 명시했다. 이슈 종료·라벨·커밋·push 변경 없음.
- 회고: 명시 게시 승인을 받은 뒤 준비된 기록을 게시했고, 재시도 시 중복을 막는 식별자를 사용했다.

## 2026-10-07 — 공급자 경로 보완·어댑터 구현

- 사용자 확인: AGY/Claude `-p /usage`, OpenCode 공식 API, Ollama OpenUsage 비공식 API 사용.
- 분담: worker1 CLI 2개, worker2 OpenCode 및 실제 어댑터 BDD, orchestrator Ollama·설정·조립.
- 결과: 5개 실제 어댑터 기본 연결. AGY/Claude 실제 실행 성공, 사용량 원문은 기록하지 않았다.
- Codex 읽기 전용 rateLimits 실제 조회도 성공했다. 세 CLI의 창 개수만 확인했다.
- 검증: check 70테스트·BDD 16시나리오/87step·타입·빌드 통과, 레포 검사 100파일·3스킬 통과.
- Ollama 서명 키와 OpenCode 환경 키가 없어 실계정 검증의 설정 정보를 사용자에게 요청했다.
- 회고: 공식 여부와 조회 경로 존재를 구분한다. 서버 실행 계정의 CLI·키 설정을 기준으로 검증한다.
- #1 #7 #13–25에 정정 댓글 15개 게시 후 원격 본문·대상 재조회 완료.
  [종합 정정](https://github.com/qus0in/yoroi/issues/1#issuecomment-6040486723).

## 2026-10-08 — 필요한 사람 조치 handle 정리

- 요청: 조치 필요한 부분을 handle 태그로 정리.
- 기존 handle 이슈가 없고 Ollama 서명 키·OpenCode 환경 키 설정이 없는 것을 재확인했다.
- [#26 Ollama](https://github.com/qus0in/yoroi/issues/26), [#27 OpenCode](https://github.com/qus0in/yoroi/issues/27)
  두 이슈를 handle·hold로 생성하고 관련 구현 이슈·설정 방법·완료 기준을 기록했다.
- 회고: 인증 설정의 사람 조치와 구현 작업을 구분하고, 설정 후 검증은 에이전트가 수행한다.
- 후속: 인증 조치 검증·pnpm 전환·0.1.0 milestone 연결은 [release-status.md](release-status.md).
