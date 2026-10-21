# 메신저 4번째 댓글(U3b) 영향 분석 (2026-10-21, w3)

- 범위: **분석 전용**(코드·테스트·워크플로 미변경 ✓ · 외부 쓰기·발행·커밋 0 ✓).
  대상: U3a-i(메신저 4역할 파이프라인·본문, 트리에 반영됨 ✓) 다음 단계인 댓글/발행 계약(U3b) ✓.
- 결론 요약: 댓글 수를 3→4로 늘리려면 **LetterParts 타입 → 댓글 조립 → publish 계약** 순으로 바꿔야 하며,
  publish 의 `comments.length !== 3`·`comments[2]` 하드코딩을 **동적 탐색으로 바꾸는 것이 필수** ✓.

## 1. 현재 댓글 3개 생성 경로

| 단계 | 파일 | 현재 동작 |
| --- | --- | --- |
| 2역할 렌더 | `src/insights/letter-markdown.ts` `renderLetterParts` | 본문(오케 Top7·워커 Top7) + `[commentOke, commentWorker, commentFree]` 3개. Free 는 `renderFreeSectionMarkdown` 로 comment 3 ✓ |
| 타입 | `src/insights/letter-parts.ts` | `LetterParts.comments: readonly [string, string, string]` (튜플 고정 3) ✓ |
| 3역할 조립 | `src/composition/insights-cli.ts` `composeThreeRoleComments` | `[o15, r15(+제외사유), workerTop15 + parts.comments[2]]` — **Free 를 워커 댓글에 문자열 결합** ✓ |
| 파이프라인 | `src/insights/letter-three-role-pipeline.ts` | `selection.messenger`(=all)·`sections.messenger` 보유 ✓, `top15` 맵은 o/r/w 만 ✓ |
| 역할 슬라이스 | `src/insights/letter-three-role.ts` | `selection.messenger?: RoleSlices` 존재 ✓, `top7`/`top15` 맵에 messenger 없음 ✓ |
| 발행 | `src/composition/insights-publish.ts` | `comments.length !== 3` 검사 ✓ · `freeSectionProblem(comments[2]!)` ✓ · dry-run 문자열 `comments=3` ✓ · 댓글 파일은 `comments.map` 로 순차 게시 ✓ |
| 복구 | `src/composition/insights-publish-recovery.ts` | `recoverMissingLetterComments` 는 파일 목록·본문 비교 기반(인덱스 무관 ✓) · `fetchIssueCommentCount` 는 개수만 반환(임계 비교 없음 ✓) |
| Free 가드 | `src/insights/letter-free-guard.ts` | `freeSectionProblem(text)` — 헤더 allow-list(`FREE_TABLE_HEADERS`)·행 개수만 검사 ✓ (텍스트 1개를 인자로 받음 → 호출부 인덱스만 영향 ✓) |

## 2. U3b(4번째 댓글) 파일 맵

| 파일 | 변경점 | 비고 |
| --- | --- | --- |
| `src/insights/letter-parts.ts` | `comments` 를 고정 튜플 → **가변(3 또는 4) 타입** + 최소 개수 규칙 | 2역할(3)·3역할(4) 공존 ✓ |
| `src/insights/letter-markdown.ts` | **Free 섹션 문자열을 별도 노출**(예 `LetterParts.freeSection`) — 3역할 조립이 Free 를 따로 붙여야 함(현재는 c3 에 문자열 결합 ✗) | U3a-ii 와 **공유 파일 충돌** ⚠ |
| `src/insights/letter-three-role.ts` | `top15.messenger` 추가(현재 `selection.messenger` 슬라이스만 ✓) | |
| `src/composition/insights-cli.ts` | `composeThreeRoleComments` → `[o15, r15, w15, m15 + Free]` | Free 분해 필요(위 참조) ✓ |
| `src/composition/insights-publish.ts` | ① `comments.length !== 3` → **3 또는 4 허용** ② `freeSectionProblem(comments[2])` → **Free 헤더가 든 댓글 동적 탐색** ③ dry-run `comments=3` → `comments=${comments.length}` | **발행 계약 변경 → 별도 소유 필요** ✓ |
| `src/composition/insights-publish-recovery.ts` | **변경 없음** ✓ (파일 목록·본문 비교 기반, 댓글 수 비의존) | |
| `src/insights/letter-free-guard.ts` | 내용 변경 없음 ✓ (호출부 인덱스만 이동) — 헤더 allow-list 확장은 U3a-ii 소유 ✓ | U3a-ii |
| `src/insights/letter-markdown-free*.ts` | U3a-ii: 메신저 열 추가 → `FREE_TABLE_HEADERS` 확장 | U3a-ii |
| 테스트 | `insights-letter-parts`(length 3) · `insights-reviewer-comment-contract`(length 3·c3=w+Free) · `insights-three-role-output`(length 3·publish) · `insights-publish-recovery`·`-boundary`(LetterParts 리터럴) · `insights-free-section`·`insights-free-reviewer-publish`(comments[2] — 2역할 경로라 유지) | 신규: 4댓글 조립·publish 3|4 허용·Free 동적 탐색·2역할 불변 |

## 3. Free 표 위치 선택지

| 선택지 | 구성 | 장점 | 비용·위험 |
| --- | --- | --- | --- |
| A안 | o15 / r15 / (w15+Free) / m15 | 렌더 분해 불필요(최소 변경 ✓) | 주문이 패킷 표기와 다름 ✗ · Free 가 가운데에 끼어 흐름이 끊김 ✗ |
| **B안(권고)** | **o15 / r15 / w15 / (m15+Free)** | 패킷 요구 순서와 일치 ✓ · Free 는 역할 공통 표라 마지막 댓글归属이 자연스러움 ✓ · 과거에도 Free 는 마지막 댓글(2역할 c3=워커+Free)에 붙었음 ✓ | 선행 조건: Free 섹션 문자열 분리 노출(`letter-markdown.ts`) ✓ · publish 가드 인덱스 → 동적 탐색 ✓ |

**권고 = B안** ✓. 근거 4항목: ① 요구 문서 표기 `o15/r15/w15/m15+Free` ✓ ② Free 표는 워커 전용이 아니라 3(→4)역할 공통 ✓
③ 历史 관례: Free 는 항상 마지막 댓글에 부착 ✓ ④ 인덱스 의존 제거가 발행 안전성(가드가 Free 부재를 잡음) ✓.

## 4. publish 계약 영향

- `comments.length !== 3` → **3 또는 4 허용**(2역할 off = 3 ✓, 3역할 on = 4 ✓). 그대로 두면 발행이 `collection or rendering failed` 로 실패 ✗.
- `freeSectionProblem(comments[2]!)` → **동적 탐색**(댓글 중 Free 헤더 포함본 선택, 없으면 `free section missing` → 발행 차단 ✓ 안전).
- `fetchIssueCommentCount` → 임계 비교가 없어 **변경 없음** ✓ (중복 게이트: OPEN 동일 제목 = 이미 발행 스킵 ✓, CLOSED 동일 제목 = 신규 발행 ✓ 그대로).
- `recoverMissingLetterComments` → 본문 동일성 검사 후 **본문별 게시** ✓ → 댓글 수 비의존 ✓. 단 기존 3댓글 이슈에 4댓글 렌더를 복구하면
  **본문 불일치로 실패**(조용한 오류 아님 ✓) → 동일 날짜 교체는 "기존 이슈 close → 신규 발행" 절차로 처리 ✓.
- dry-run 출력 `comments=3` → 동적 표기 ✓ (워크플로 dry-run 점검 항목 갱신 필요 · `.github/workflows/letter-publish.yml` = 소유 외 → 보고만 ✓).
- body 파일 모드 0600·repo 정규화 검사·`closePreviousLetters`(`letter` 라벨만) → 무관 ✓.

## 5. U3a-ii 충돌·구현 순서·소유

- **충돌 지점**: `src/insights/letter-markdown.ts`(Free 렌더·헤더) ⚠ · `src/insights/letter-free-guard.ts`(헤더 allow-list) ⚠ ·
  `src/insights/letter-markdown-free-table.ts`(`FREE_TABLE_HEADERS`) ⚠ → **U3b-1(LetterParts 타입·Free 섹션 노출)이 letter-markdown.ts 를 함께 건드림** ⚠.
- **권장 순서**: ① **U3a-ii**(Free 4역할 열·가드 헤더 허용) → ② **U3b-1**(LetterParts 가변 타입·Free 섹션 노출·top15 messenger 맵) →
  ③ **U3b-2**(댓글 조립 4개: insights-cli) → ④ **U3b-3**(publish 계약·dry-run) → ⑤ **U3b-4**(회귀 테스트).
  ②와 ③은 ① 뒤에만 ✓ (Free 표 내용 확정 후 댓글 이동 ✓).
- **소유 제안**: U3a-ii = w1(Free 렌더·가드) · U3b-1 = w3(parts·three-role·markdown 타입) · U3b-2 = w3(insights-cli) ·
  **U3b-3 = 오케스트레이터**(발행 계약 변경은 별도 승인 필요 ✓ · 워크플로 동시 갱신) ✓.

## 6. 위험

1. **부분 배포 위험** — 댓글 조립(4개)과 publish 계약(3|4 허용)이 어긋나면 발행 실패 ✓ → 같은 배포 묶음으로 ✓.
2. **Free 탐색 실패** — 동적 탐색이 Free 댓글을 못 찾으면 가드가 `free section missing` 으로 **발행 전 차단** ✓(오발행보다 안전 ✓).
3. **복구 경로** — 3댓글 기존 이슈 + 4댓글 렌더 = 본문 불일치 실패 ✓ → 운영 절차(동일 날짜 close→재발행) 문서화 필요 ✓.
4. **LetterParts 타입 변경 파급** — 튜플→가변 변경이 다수 테스트 리터럴에 영향 ✓ → U3b-1 에서 한 번에 정리 ✓.
5. **2역할 회귀** — 3역할 off 인 로컬·2댓글 경로가 3개 댓글을 유지하는지 반드시 고정 ✓ (publish 가 3|4 동시 허용 ✓).

## 7. 다음 패킷 초안

- task_id `yoroi-messenger-comment4-step1` · 소유: `src/insights/letter-parts.ts`, `src/insights/letter-markdown.ts`,
  `src/insights/letter-three-role.ts`, `src/insights/letter-three-role-pipeline.ts`, `tests/insights-letter-parts.test.ts`,
  `tests/insights-reviewer-comment-contract.test.ts`, `docs/insights/messenger-comment4-step1-20261021.md`
- 기준: ① `LetterParts.comments` 가 3/4 를 모두 표현 가능(2역할 3 · 3역할 4) ② Free 섹션 문자열 별도 노출로 조립 가능 ③
  `top15.messenger` 제공(15행 컷) ④ **댓글 조립·publish 계약은 아직 미변경**(댓글 3개 유지) ⑤ 기존 출력 불변 회귀
- 검증: focused 테스트·typecheck·validate-repo·diff-check · 전체 check 는 통합 트리 1회 ✓
- 금지: publish 계약 변경 · Free 표 열 추가(U3a-ii) · 점수·가중치 변경 · 외부 쓰기 ✓
