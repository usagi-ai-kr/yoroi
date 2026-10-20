# 이슈 작업 배정 (2026-10-20)

요청: 패널 확인 및 현재 이슈에서 반영할 작업 분배.
기준 HEAD e3abe25, 요청 시작 작업트리 clean. 기존 패널만 사용한다.

## 현재 확인

- w1 w18:p2: Muse Spark 1.3 Contributor xhigh, idle.
- w2 w18:p3: Gemini 3.8 Flash high, idle.
- w3 w18:p4: MiniMax M3.1 Flash Free max, idle. 신규 패널을 로스터에 등록.
- 열린 작업 이슈 #180·#190·#168. #187은 letter이므로 배정 제외.
- PR #191(dev→main) head 5532dac, BEHIND, PR CI CANCELLED.
- 로컬 dev에는 후속 하네스 e3abe25가 있고 PR에 아직 포함되지 않았다.
- 자동 push·머지·모델호출·세션 조작은 이번 분배 단위에서 하지 않는다.

## 단위 A — w1, #190 코딩 서브셋 파서 첫 단위

- 소유: src/insights/arena-coding-parser.ts, arena-coding-types.ts,
  arena-coding-model.ts, tests/insights-arena-coding-parser.test.ts,
  docs/insights/arena-coding-unit1.md (src 이름 접두는 모두 src/insights/).
- HF 공식 데이터셋 문서·스키마와 기존 정규화 인터페이스를 확인한다.
  실제 스키마 확인 불가면 추측 구현하지 말고 미확인 근거·계약만 보고한다.
- webdev 및 agent 중 명시적 코딩 신호만 허용. 비코딩 배제.
- 날짜형 effort 변형 지원, 유사 이름 자동 병합 금지.
- source 계통은 기존 overall과 분리. 신규 source id 계약만 정의한다.
- 이 단위는 순수 파서/정규화와 합성 fixture 검증까지만 구현한다.
  once 연결·DB migration·점수 가중치·실데이터 저장·기존 공통파일 수정 금지.
- 집중 테스트·타입검사·레포검증. 전체 이슈 완료로 보고하지 않는다.

## 단위 B — w2, #180 및 PR #191 반영 점검

- 소유: docs/insights/calibration-release-audit-20261020.md만.
- 이슈 본문·댓글·현재 코드·PR diff 및 실제 head/CI를 대조한다.
- #180 완료 주장과 알려진 한계/후속을 분리. 재구현·실모델 실행 금지.
- PR CI 취소/BEHIND 원인과 로컬 미게시 커밋 목록을 확인한다.
- 이미 통과한 동일 입력의 check는 재실행하지 않는다. 변경 필요시 근거 보고.
- close/PR변경/push/머지/버전/전역설치 변경은 하지 않는다.
- 다음 리뷰 담당: A 구현 결과를 w2가 검토(별도 패킷으로 후속 배정).

## 단위 C — w3, #168 설계·소유 경계

- 소유: docs/insights/model-discovery-unit1.md만.
- 이슈의 기존 설계 결정과 현재 catalog/detect/list config 흐름을 대조한다.
- registry diff·stdout·last-good 1세대/30일, ban/allowOlder 같은 설정파일
  확장, 공식 메타데이터 충족시 후보편입 조건을 기존 결정대로 구체화한다.
- 공식 출처 없는 verified=true·유사명 병합·지표 생성 금지.
- 첫 구현 단위의 타입·파일·AC·fixture를 제안하고 코드수정은 하지 않는다.
- 설계결정 변경·외부인프라·모델호출 금지. 미확인 제공자 경로는 표시한다.

## 공통 완료·소유

- 총괄 소유: 이 문서, docs/orchestration.md, docs/tasks.md.
- 각 워커의 최종 의견은 먼저 위 소유 docs 및 패킷 보고서에 기록한다.
- 모든 직접 작성파일100줄 이하. README/AGENTS 수정금지.
- 5분 내 단위, 주요 진척·막힌 점·남은 일을 보고한다.
- 최종 python3 scripts/validate-repo.py·git diff --check 실행.
- 커밋은 총괄이 별도 독립 리뷰 뒤 수행. 이번 패킷에서 commit/push/PR 금지.
- 서브에이전트·새 패널·모델변경·세션 재시작 금지.
