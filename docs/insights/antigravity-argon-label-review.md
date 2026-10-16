# argon 라벨 독립 리뷰 (#165, 2026-10-16)

## 대상
- w1 구현: `src/ui/cli/labels.ts`(100줄, +9/-4)·`tests/window-labels.test.ts`(100줄, +4). 보고 `/tmp/yoroi-165-label-implementation-w1-report.json`.
- 배정/사양: `docs/insights/antigravity-argon-assignment.md`, #165 확정 코멘트. 구현 소스 읽기 전용.

## 판정: PASS (관찰 1건)
- **라벨 4종 정확**: 4창 동시 `['g-w','g-5h','c-w','g-w-a']`, 역순 입력도 순서 독립(`['g-w-a','c-w','g-5h','g-w']`).
- **원인·수정 최소**: `agy()`가 prefix에 `argon` 포함 시 base를 `w-a`/`5h-a`로 분리 → argon이 단독 그룹이 되어 `labelsFor`가 `g-w-a` 산출, gemini-models는 `w` 그룹에 남아 `g-w` 유지(원본ID 폴백 방지). Base 유니언에 `5h-a|w-a` 추가. parser·labelsFor 충돌 로직·비-argon 경로 무변경.
- **회귀**: 기존 9 테스트 전부 통과, 신규 1 포함 10/10. gemini 단독 `w`, 비-argon 동작 불변.
- **원본ID 보존**: parser·domain·insights 무변경(score.ts 변경은 기존 worker dirty hunk `0f766be8…`, w1 소유 아님).
- **스코어 불변**: 스코어링·가중치·정규 보정 파일 w1 미접촉.
- **줄 수**: labels.ts 100·window-labels.test.ts 100(≤100). typecheck PASS·validate 687 PASS·diff-check 0.
- **보존**: 사용자 dirty(score.ts·four-source·orchestration) 유지.

## 관찰 (결함 아님, 정책 확인 요망)
- argon이 agy에서 **단독**일 때 라벨은 `w-a`(사양표의 `g-w-a` 아님). 기존 단일 창 규칙(gemini 단독 `w`)과 일관된 동작이다. 결합 입력에서만 `g-w-a`가 된다. 필요하면 후속 정책 결정 사항.
- argon AA 결측 정책은 사용자 선택 전 미확정(배정문 27–29행).

## 금지 준수
- 소유 docs+JSON만. 커밋·push·PR·merge·Release·global·letter·새 이슈/라벨/마일스톤 0. 보고 후 메신저 지시 대기.
