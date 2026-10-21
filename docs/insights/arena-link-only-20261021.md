# Agent Arena 링크-only 참고 (2026-10-21, w3 · #226)

- 목표: 레터 details 에 Agent Arena 참고 **링크 1줄**만 추가 ✓ — 자동 수집·점수 반영 없음 ✓.
  (타당성 검토 결론: 공식 API·ToS 미확인 → 링크-only ✓)
- 금지 준수: 외부 API·크롤링·실계정 호출·데이터 저장·점수 생성 0건 ✓ · 점수·순위·가중치·후보 수집·Free 표 불변 ✓.

## 1. 변경 파일

| 파일 | 변경 |
| --- | --- |
| `src/insights/letter-markdown-format.ts` (75줄) | `ARENA_REFERENCE_LINE` 추가 — `참고: Agent Arena 비용·Net Improvement — https://arena.ai/leaderboard/agent (자동 수집·점수 미반영, 2026-10-21 확인)` ✓ · **`SOURCE_LINES`(수집 출처 registry)에는 넣지 않음** ✓ · **추가 지시(DELTA)**: 59행 가중치 줄의 `워커·메신저` → `워커` (메신저 언급 제거 ✓ · Agent Arena 링크·수집 출처 목록은 유지 ✓) |
| `src/insights/letter-markdown.ts` (96줄) | details 블록에 `### 참고` 섹션 + `ARENA_REFERENCE_LINE` 1줄 ✓ (기존 `### 출처`·`SOURCE_LINES` 그대로 ✓) |
| `tests/insights-arena-link-only.test.ts` (신규 46줄) | 참고 링크·문구 1줄 ✓ / 수집 출처 registry·배지·출처 목록 불변 ✓ / 본문 표·점수·순위 불변 ✓ / 2역할·3역할 모두 표시 ✓ |
| `tests/insights-markdown-legend.test.ts` (100줄) | details 참고 링크·미반영 명시·수집 출처 제외 단언 추가 ✓ (기존 케이스 의미 보존 압축) |
| `tests/insights-render-top10.test.ts` (84줄) | **stale 기대값 수정**(워커 제목이 `## 🛠️ 워커 Top10` 로 분리됨 — w1 메신저 제거 반영) ✓ |
| `docs/insights/arena-link-only-20261021.md` (신규) | 계약·변경·불변 증빙·#226 close 조건 ✓ |

## 2. 표시·불변 규칙

- **표시 위치** ✓: `출처 및 산출 공식` details 안의 `### 참고` 블록 (수집 출처 `### 출처` 와 분리 ✓).
- **문구** ✓: 링크 + `자동 수집·점수 미반영, 2026-10-21 확인` ✓ — 수집·점수 반영이 아님을 명시 ✓.
- **수집 출처 registry 불변** ✓: `SOURCE_LINES`/`SOURCE_ATTRIBUTIONS` 미변경 ✓ → `sources N total` 배지 **5 유지** ✓ · `### 출처` 목록에 Agent Arena 없음 ✓.
- **점수·순위·본문 표·댓글·Free 표 불변** ✓ (details 밖 영역 무변경 ✓).
- **2역할·3역할 모두 표시** ✓ — details 블록은 두 경로가 공유 ✓ (3역할 본문 교체 `replaceLegacyRoleBlocks` 가 details 를 보존 ✓).

## 3. 검증

| 항목 | 결과 |
| --- | --- |
| focused 테스트 | **43/43 통과** ✓ (arena-link-only 4 + markdown-legend 9 + render-top10 8 + markdown 3 + top10-source-policy 6 + cli 13 + composition) |
| `pnpm run check` | **단위 1431/1431 · BDD 45 시나리오/635 스텝 · typecheck·build EXIT=0** ✓ 로그 `tmp/yoroi-226-arena-link-only-check.log` |
| `pnpm run typecheck` | 오류 0건 ✓ |
| `python3 scripts/validate-repo.py` | 위반 0건 ✓ (exit 0) |
| `git diff --check` | clean ✓ |
| 금지 준수 | api_call 0 · crawling 0 · data_collection 0 · 점수·가중치·순위 변경 0 · 재발행 0 · 소유 외 파일 수정 0 ✓ · 커밋·push·외부 쓰기 0 ✓ |

## 4. 확인 필요(보고만)

- **compact 미리보기에는 표시되지 않음** ✓ — compact 렌더(`renderTop10FromRecords`)는 별도 `'## 출처 및 안내'` 축약형을 쓰므로 해당 줄이 없다 ✓.
  발행물(전체 레터)에는 표시됨 ✓ → compact 에도 넣을지는 별도 결정 ✓ (소유 외 파일 `letter-top10-render.ts`).
- **링크의 유효성 미검증** ✓ — 이번 단위는 링크 문자열만 넣고 외부 접속을 하지 않았다 ✓ (`api_call`/`crawling` 금지 ✓).
  링크·문구 최종 확인은 발행 전 수동 확인 필요 ✓.
- **#226 close 조건** ✓: (1) 발행 후 새 레터 details 에 `### 참고` + 링크 1줄 표시 ✓ (2) `sources N total` 배지 불변 ✓
  (3) `### 출처` 목록에 Agent Arena 없음 ✓ (4) 본문·댓글·점수·순위·Free 표 변화 없음 ✓ (5) 외부 호출·수집 흔적 없음 ✓ → 확인 후 close ✓.
- **데이터 도입은 별도 정책 결정으로 남김** ✓ (공식 API·ToS 확인 전 수집 금지 ✓).

## 4-1. DELTA 반영(#226 추가 정합)

- `src/insights/letter-markdown-format.ts` 59행: `- 가중치: 오케·리뷰어 … / 워커·메신저 …` → `… / 워커 …` ✓ (메신저 언급 제거 ✓).
- Agent Arena 참고 링크와 `### 출처` 수집 출처 목록은 **그대로 유지** ✓ (수집 출처 registry `SOURCE_LINES` 무변경 ✓ · 배지 불변 ✓).
- `tests/insights-markdown-legend.test.ts` **100줄 유지** ✓ (신규 케이스 추가 시 기존 케이스 압축으로 유지 ✓).
- 잔여(보고만): 2역할 요약 줄의 '워커·메신저' 표기는 데이터 측 역할명에서 옵니다 ✓ (본 단위 소유 파일 밖 ✗) → 해당 경로 정리 필요 ✓.

## 5. 동시 진행분과의 정합(참고)

- w1 의 **메신저 제거**(U3b 4댓글 계약 → 3댓글 복귀 ✓)로 내가 U3b 에서 추가했던 4댓글 복구 테스트가 타입 불일치가 되어,
  **내 소유 테스트 1건**(`tests/insights-publish-recovery.test.ts`)을 현재 계약(3댓글)에 맞춰 정리 ✓ (소유 범위 내 ✓).
- `tests/insights-render-top10.test.ts` 의 워커 제목 기대값도 같은 이유로 갱신 ✓ (소유 범위 내 ✓).
- **추가**: `tests/insights-markdown.test.ts` 의 워커 제목·자격·가중치 기대값 3곳이 '워커·메신저' 였으나
  w1 메신저 제거 + 이번 DELTA(59행)로 실제 출력이 '워커' 로 바뀌어 **기대값만** 갱신 ✓ (소유 외 파일 1건 · 사유: 소스 변경의 직접 결과 ✓ · 보고 ✓).
  (`features/insights.feature` 의 동일 기대값은 w1 이 이미 갱신 ✓ → BDD 45/635 통과 ✓.)
