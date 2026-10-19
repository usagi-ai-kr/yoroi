# 하네스 학습 패널 인계 (2026-10-20)

- 사용자: moi, dalmuti 등에서 하네스 학습. 서브에이전트 대신 다른 패널로 진행.
- 서브에이전트3개 모두 인터럽트. 남은 스킬2개 초안은 재검토 필요.
- 총괄 w18:p1, 구현 w18:p2(w1), 독립 조사/리뷰 w18:p3(w2).
- 원본 Workspace 형제 저장소 moi·the-great-dalmuti·paul 읽기 전용.
- 모델·세션·패널 생성/변경 금지. 기존 실행 워커 사용.

## 구현 소유 파일

.agents/skills/harness-improvement/SKILL.md,
.agents/skills/skill-authoring/SKILL.md, .github/workflows/ci.yml,
docs/development.md, docs/tasks.md, docs/insights/harness-cross-repo-learning.md.
이 문서는 총괄 소유. 리뷰어는 보고서 외 수정 금지.

## 완료 기준

1. 원문 재확인: moi harness-budget 및 tdd-bdd-testing/scripts/run-gates.mjs,
   dalmuti harness·codify·orchestrate 스킬, paul retro·task-slice 검증 참조.
2. 학습기록에 출처·yoroi 차이·채택/기존충족/보류·근거 기록.
3. 스킬 초안 재검토: 사용자 요청 학습과 자동 장애 조치 구분,
   후보 평가·단일소유·선택읽기·검증 실제실행/미실행 구분.
4. CI docs-only에서도 validate-repo.py --ci 항상 실행하도록 분리.
   앱빌드/기존테스트의 docs-only 생략 유지. docs/development 설명 갱신.
5. 모델리셋·자동폐기·권한·커밋/머지정책·예산수치 복사 금지.
   바이트예산·인덱스/임시경로 자동검사는 이번 최소 변경에서 보류 후보.
6. README/AGENTS 수정금지. 작성파일100줄 이하. 소유밖 수정금지.
7. 최종 python3 scripts/validate-repo.py 및 git diff --check 실행.
   CI docs_only true/false 조건 확인. 원격CI 미실행과 로컬통과 구분.
8. 패킷 report_path에 실제 변경파일/검증 기록. 커밋·push·PR 금지.
   총괄이 독립 리뷰 뒤 해당파일만 커밋. 5분단위 진행보고.
9. 사용자 패널 지정은 일반 서브에이전트 허용보다 우선. 재배정으로 적용.

## 완료 전 보완 (총괄 확인)

- 이번 사용자 요청 시작 시 git status는 깨끗했다. 스킬2개 초안은 사용자 변경이 아니라
  이번 요청에서 중지한 서브에이전트가 작성했다. 패널은 해당 초안을 독립 재검토한 것이다.
- 학습 기록은 변경 전 yoroi와 비교해야 한다. 이번 추가 절차를 기존충족으로 적지 않는다.
  후보 평가·단일소유·선택읽기·실행/미실행 구분은 이번 요청의 채택으로 기록한다.
- 출처는 docs/insights 기준 ../../../moi/ 등 실제 상대 Markdown 링크로 연결한다.
- docs/tasks.md에 요청·소유·검증·학습 기록 링크를 남긴다(최초 완료기준2 및 소유 목록).
- 원격CI 미실행, 로컬 검사 실명령·exit코드는 영구 학습 기록에도 명시한다.
