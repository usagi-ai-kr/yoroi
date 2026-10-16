# #165 라벨 선행 단위 구현 (w1, 2026-10-16)

- 소유: `src/ui/cli/labels.ts` · `tests/window-labels.test.ts` · 본 문서 · 보고 JSON.
- 근거: [배정](antigravity-argon-assignment.md), 이슈 [#165](https://github.com/qus0in/yoroi/issues/165) + [확정 코멘트](https://github.com/qus0in/yoroi/issues/165#issuecomment-6206154424) (읽기전용 확인, 새 이슈·라벨·마일스톤 생성 없음).
- 소유 파일 전부 clean(diff 구분 없음), README·AGENTS·src/insights·config·버전·worker·score·letter·parser 원본ID 무변경. 커밋·push·PR·머지·발행·전역설치 없음.

## 목표 라벨 4개 (확정코멘트와 일치)

| 창 id (원본, parser 유지) | 목표 |
| --- | --- |
| `gemini-models:weekly-limit-remaining` | `g-w` |
| `gemini-models:five-hour-limit-remaining` | `g-5h` |
| `claude-and-gpt-models:weekly-limit-remaining` | `c-w` |
| `gemini-4-argon:gemini-4-argon-weekly-limit` | `g-w-a` |

## 원인 (확정코멘트 실측과 동일)

- `agy(id)`는 `prefix:slug` 분할 후 `stages = [word(prefix)[0], word(prefix)]`. `word('gemini-4-argon')`·`word('gemini-models')` 둘 다 `gemini` → `stages ['g','gemini']`로 **완전 동일**.
- argon slug가 `weekly`라 둘 다 `base 'w'`. `labelsFor()`가 같은 `w` 그룹에서: stage0 `c-w,g-w,g-w` 2중복 → stage1 `c-w,gemini-w,gemini-w` 2중복 → stage2 `stages[2]` 부재로 동일 → 최종 **둘 다 `entry.id` 원본ID 폴백**.
- → argon 합류가 **기존 `g-w`를 원본ID로 깨뜨림**. 같은 그룹 안 단계 모델로는 `g-w` 유지 + argon만 `-a` 접미를 만들 수 없음(코멘트 결론과 동일).

## 수정 (labels.ts 2곳, +1행 → 100행)

- `agy()`: argon 식별자(`prefix`에 `argon` 포함)를 감지해 `base`를 `w`→`w-a`(·`five-hour`→`5h-a`)로 **분리**. argon이 `w-a` 단독 그룹이 되어 `labelsFor([argon],'w-a')`가 `${stages[0]}-w-a = g-w-a`를 산출. gemini-models는 `w` 그룹에 남아 `g-w` 유지(원본ID 폴백 없음).
- `Base` 유니언에 `"5h-a" | "w-a"` 추가(로컬 타입, 미export).
- parser 원본ID·`labelsFor` 충돌 모델·기타 공급자 로직 **무변경** (argon 분기만 추가 → 비-argon은 기존과 동일).

## 검증 (5분 단위)

- `tests/window-labels.test.ts` **10/10 통과**: 기존 9개 회귀(argon 미포함 그대로 통과) + 신규 1개.
- 신규 테스트: 4개 동시입력 → `["g-w","g-5h","c-w","g-w-a"]`, **역순 재입력** → `["g-w-a","c-w","g-5h","g-w"]` (동시입력·순서독립 동시 검증, gemini `g-w` 유지 확인).
- typecheck PASS · `validate-repo` PASS · 줄 수 labels 100 / test 100 (≤100 준수).
- 긴 전체 빌드·`yoroi once --full` 미수행(패킷상 금지·독립리뷰는 w2 별도). 소스 core·git·원격 무변경.

## 후행

- 독립 리뷰(w2-codex p18) 예약분 — 별도 지시로 전달 예정, 이 단위 보고 후 자동 후속 없이 메신저 지시 대기.
- argon 레터 포함·AA 결측 후보 정책은 별도 단위(사용자 선택 필요).
