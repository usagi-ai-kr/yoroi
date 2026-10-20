# 하네스 타 저장소 학습 기록 (2026-10-20)

요청 시작 시 HEAD `5532dac`·`git status` clean이었다. 스킬 초안 2건은
본 요청 중 root 서브에이전트가 작성했고, 사용자 지시로 중단된 뒤 기존
패널이 원문과 재대조했다(w1 대조 기록, w2 최종 독립 리뷰 완료·통과).
세션 시작 시점과 요청 시작 시점을 혼동하지 않는다.
읽기 전용 대조이며 수치·모델·세션·권한·커밋 정책은 승계하지 않는다.

## moi harness-budget — 보류

- 출처: [SKILL](../../../moi/.agents/skills/harness-budget/SKILL.md),
  [검사 스크립트](../../../moi/.agents/skills/harness-budget/scripts/check-module-lengths.mjs).
  줄·바이트·토큰 예산 검사, CI 필수·초과 차단(수치는 승계하지 않음).
- yoroi 차이: `validate-repo.py` 줄 수 검사 + `validate.sh`만 있고
  바이트·토큰·인덱스 자동검사가 없다.
- 판정: 보류. 이번 최소 변경에 넣지 않는다.

## moi run-gates fail-closed — 기존충족

- 출처: [run-gates.mjs](../../../moi/.agents/skills/tdd-bdd-testing/scripts/run-gates.mjs).
  필수 게이트 미정의·실패는 exit 1, `package.json` 부재만 예외.
- yoroi는 HEAD부터 `pnpm run check` 고정 게이트(typecheck·단위·BDD·빌드)로
  미정의 스킵-성공 경로가 없다. 이번 요청 변경 없음.
- 판정: 기존충족.

## dalmuti harness 후보 평가 — 이번 요청 채택

- 출처: [harness](../../../the-great-dalmuti/.agents/skills/harness/SKILL.md).
  신호는 후보일 뿐, 증거 기반만 변경한다.
- 채택: `harness-improvement` 사용자 요청 학습 점검 1-5항(서브에이전트
  초안 + w1 1줄 보강). rolling 단일 ledger는 `tasks.md`로 대체해 보류.

## dalmuti codify 단일 소유·선택 읽기 — 이번 요청 채택

- 출처: [codify](../../../the-great-dalmuti/.agents/skills/codify/SKILL.md).
  최초 일치 분류, 한 곳 관리·상대 링크, 판단 필요 부분만 읽기.
- 채택: `skill-authoring` 읽기 범위 절차 소유 절 + `harness-improvement`
  2항 후반(서브에이전트 초안 + w1 대조). README 사용자 저작은
  yoroi HEAD 원칙과 일치해 변경 없음.

## dalmuti orchestrate — 보류 (Herdr-only 정책 미이식)

- 출처: [orchestrate](../../../the-great-dalmuti/.agents/skills/orchestrate/SKILL.md).
  Herdr 전용 위임, 네이티브 서브에이전트 대체 금지.
- yoroi 차이: yoroi HEAD는 Herdr 패널 구성과 일부 서브에이전트 허용이 공존한다.
  본 요청 처음에 서브에이전트를 썼고 사용자 지시 후 패널로 전환했다.
  dalmuti의 Herdr-only 영구 정책은 이식하지 않고 보류한다.
- 판정: 보류 (기존 yoroi 협업 규칙 유지).

## paul retro — 기존충족

- 출처: [retro](../../../paul/.agents/skills/retro/SKILL.md).
  완료 후 회고, 단일 소유·압축, 일회 선호 자동 영구화 금지.
- yoroi HEAD(`AGENTS.md` 룰 변경 요청 시만 + `skill-authoring` 회고절)와
  일치한다. 이번 요청 변경 없음.
- 판정: 기존충족.

## paul task-slice 검증 실제 실행 구분 — 이번 요청 채택

- 출처: [task-slice](../../../paul/.agents/skills/task-slice/SKILL.md),
  [verification](../../../paul/.agents/skills/task-slice/references/verification.md).
  도구 존재≠실행 증거, exit 0≠통과, 미실행≠통과.
- 채택: `skill-authoring` 검증 3항(서브에이전트 초안 + w1 대조).
  `harness-improvement` 27줄 원칙도 같은 구분을 둔다.
- 판정: 이번 요청 채택.

## 이번 요청 채택 정리

이번 요청에서 작성한 스킬 초안을 기존 w1 패널이 원문과 재대조했고
w2가 최종 독립 리뷰를 완료·통과했다.
핵심 채택은 4가지다:
1. dalmuti harness: 사용자 요청 학습 후보 평가 절차(`harness-improvement`).
2. dalmuti codify: 단일 소유 및 선택 읽기(`skill-authoring`).
3. paul verification: 검증 실제 실행·미실행 구분(`skill-authoring`).
4. CI 분리: docs-only에서도 `validate-repo.py --ci` 항상 실행(`ci.yml`, `development.md`).

## 검증 (로컬 실행, exit 0)

- `bash .agents/skills/skill-authoring/scripts/validate.sh .agents/skills/harness-improvement 100` → PASS.
- `python3 scripts/validate-repo.py` → PASS (796 files).
- `python3 -m unittest discover -s scripts -p "test_*.py"` → 19 OK.
- `git diff --check` → clean.
- 원격 CI 미실행. 로컬 통과만 기록한다.
