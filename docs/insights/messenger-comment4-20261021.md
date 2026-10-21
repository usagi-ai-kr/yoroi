# 메신저 4번째 댓글 구현 (2026-10-21, w3 · #227 U3b)

- 목표: **2역할 3댓글을 유지**하면서 3역할+메신저 경로를 **4댓글**로 확장하고, publish 계약을 3|4 로 넓힌다 ✓.
- 기준: `docs/insights/messenger-comments-impact-20261021.md` (분석) + `tmp/yoroi-227-messenger-u3b-packet.json` ✓.
- 승인: 사용자가 #227 메신저 4번째 섹션·재발행을 요청했고, publish 계약 변경(3|4 허용·Free 동적 탐색)을 승인 ✓.

## 1. 변경 파일과 내용

| 파일 | 변경 |
| --- | --- |
| `src/insights/letter-parts.ts` (12줄) | `LetterComments = [string,string,string] \| [string,string,string,string]` (3\|4 표현) · `LetterParts.freeSection?` 추가(별도 Free 문자열) ✓ |
| `src/insights/letter-markdown.ts` (98줄) | `renderLetterParts` 가 `freeSection` 을 함께 반환(2역할 `comments[2]` 와 **동일 문자열** → 2역할 출력 바이트 동일 ✓) · `renderTop10Markdown` 1줄 압축(줄 수 유지) ✓ |
| `src/insights/letter-three-role.ts` (94줄) | `top7`/`top15` 맵에 `messenger?` 추가(있을 때만) ✓ — `selection.messenger` 슬라이스는 이미 제공 ✓ |
| `src/composition/insights-cli.ts` (100줄) | `composeThreeRoleComments` → `[o15, r15, w15, m15+Free]` 4댓글 / 메신저 없으면 `[o15, r15, w15+Free]` 3댓글 폴백 ✓ · Free 문자열은 `parts.freeSection` 사용 ✓ · 줄 수 유지를 위한 인자 병합 압축 ✓ |
| `src/composition/insights-publish.ts` (92줄) | 댓글 개수 **3\|4 허용** ✓ · Free 가드를 **동적 탐색**(Free 헤딩을 담은 댓글) ✓ · 없으면 발행 차단 ✓ · dry-run `comments=${comments.length}` ✓ |
| `tests/insights-letter-parts.test.ts` (50줄) | 2역할 3댓글 불변 + `freeSection === comments[2]` ✓ |
| `tests/insights-reviewer-comment-contract.test.ts` (82줄) | 4댓글 순서(o/r/w/m+Free) ✓ · 제목 분리(🛠️ 워커 Top15 / ✉️ 메신저 Top15, '워커·메신저' 없음) ✓ · 메신저 없음 3댓글 폴백 ✓ |
| `tests/insights-publish-recovery.test.ts` (98줄) | 기존 복구 케이스 유지 ✓ + U3b: 기존 OPEN 레터에 4댓글로 복구 — 없는 댓글만 게시 ✓ (본문 불일치 시 실패는 기존 경계 테스트가 유지 ✓) |
| `tests/insights-publish-comments.test.ts` (88줄) | 기존 1.2.0 발행 댓글 흐름 3건 **유지** ✓ + U3b 4건(4댓글 성공·Free 없음 차단·5댓글 거부·dry-run 개수) ✓ |
| `src/insights/letter-three-role-pipeline.ts` (100줄, 무변경) | `selection.messenger`(top7/top15 슬라이스) 가 이미 제공되어 **변경 불필요** ✓ |

## 2. 댓글 수 분기 규칙

| 경로 | 댓글 | 구성 |
| --- | --- | --- |
| 2역할(3역할 off) | **3** | `o15 · w15 · Free` (기존과 바이트 동일 ✓) |
| 3역할 + 메신저 없음 | **3** | `o15 · r15 · w15+Free` (기존 3역할과 동일 ✓) |
| 3역할 + 메신저 있음 | **4** | `o15 · r15 · w15 · m15+Free` ✓ |
| 그 외 | 거부 | publish 가 `collection or rendering failed` 로 차단 ✓ |

- 4댓글은 **메신저가 있을 때만** ✓ (폴백 3댓글 유지 ✓) → 기본 3역할 출력 변화 없음 ✓.
- 레거시 2역할 제목 `ROLE_HEADINGS_TOP15('워커·메신저')` 는 **유지** ✓ · 3/4역할 조립만 `THREE_ROLE_TITLES` 제목(🛠️ 워커 / ✉️ 메신저) 사용 ✓.

## 3. Free 탐색 규칙

- publish 는 `comments.find(c => c.includes(FREE_HEADING))` 로 **Free 헤딩을 포함한 댓글**을 찾는다 ✓ (고정 `comments[2]` 아님 ✓).
- 해당 댓글이 없으면 `freeSectionProblem('')` → `free section missing` → **발행 차단** ✓.
- 찾은 댓글에 대해 기존 가드(헤더 allow-list·행 개수) 그대로 적용 ✓ → 4역할 Free 4열 헤더도 allow-list 에 있으므로 통과 ✓.
- 2역할은 `comments[2]` 가 Free ✓ → 동적 탐색이 같은 댓글을 찾음 ✓ (동작 동일 ✓).

## 4. 변경하지 않은 것

- 중복 게이트(`listIssues` 1회 조회 → OPEN 스킵 / CLOSED 신규 발행) ✓ · `closePreviousLetters` ✓ · 복구 경로(`recoverMissingLetterComments`) ✓.
- 점수·가중치·Free 표 열·워크플로 **무변경** ✓ (워크플로는 dry-run 문자열이 CLI 출력에서 나온다 → 워크플로 수정 불필요 ✓).
- **3댓글 기존 이슈에 4댓글 렌더 복구** → 본문 불일치로 실패 ✓ → 같은 날짜 교체는 기존 `close → 신규 발행` 절차 ✓.

## 5. 검증

| 항목 | 결과 |
| --- | --- |
| focused 테스트 | **80/80 통과** ✓ (letter-parts·reviewer-comment-contract·three-role-output·publish-comments·publish-recovery·recovery-boundary·free-section·free-reviewer·three-role 렌더/본문·composition) |
| `pnpm run check` | **단위 1440/1440 · BDD 45 시나리오/635 스텝 · typecheck·build 통과(EXIT=0)** ✓ 로그 `tmp/yoroi-227-messenger-u3b-check.log` |
| `pnpm run typecheck` | 오류 0건 ✓ |
| `python3 scripts/validate-repo.py` | 위반 0건 ✓ (각 파일 ≤100줄 ✓) |
| `git diff --check` | clean ✓ |
| 금지 준수 | 점수·가중치 변경 0 · Free 표 열 변경 0 · 워크플로 변경 0 · 점수 생성 0 · 소유 외 파일 수정 0 · 커밋·push·외부 쓰기 0 ✓ |

## 6. U4 발행 위험

1. **댓글 수만 늘고 본문은 4섹션** → 발행물 검증 시 본문 4섹션(✉️ 메신저 포함) + 댓글 4개 + Free 는 마지막 댓글에 있는지 확인 ✓.
2. **기존 3댓글 레터 복구 실패** — 같은 날짜 교체는 반드시 기존 이슈 close 후 신규 발행 ✓ (복구 시도 시 본문 불일치 실패 ✓).
3. **Free 가드 인덱스 의존 제거 완료** ✓ → 댓글 순서 변경에도 가드가 Free 를 찾는다 ✓.
4. **2역할 회귀** — 로컬·워크플로 모두 3역할 on ✓ (2역할 경로는 3댓글 유지 ✓ 회귀 테스트로 고정 ✓).
5. **dry-run 표기** — `comments=4` 로 실제 개수 노출 ✓ (운영 점검 시 확인 ✓).
