# Free 티어 정렬 기준(#246) 독립 리뷰 (2026-10-21, w3)

- 범위: w1 의 #246 구현(Free 행 정렬 기준 확정 + 정렬 각주 갱신)을 **실제 diff·실행으로** 독립 리뷰 ✓.
  읽기 전용 — 코드·테스트 미수정 ✓ · 커밋·push·발행·외부 쓰기 0건 ✓.
- **종합 판정: PASS** (BLOCK 0건) — 확정 기준 4단계 그대로 구현 ✓ · 모델명 하드코딩 0 ✓ · 기대 순서 실측 일치 ✓.

## 1. 실제 변경 (diff 대조)

`src/insights/letter-markdown-free-sort.ts`:
- `roleCells(row)` = `[orchestrator, reviewer, worker]` ✓ (FreeCell 만 사용 ✓).
- `passedCount(row)` = passed 셀 수 ✓ (모델명 무관 ✓).
- `bestScore(row)` = **passed 셀 중** 최고 표시 점수, 없으면 `-Infinity` ✓.
- 정렬 비교: `passedCount(b) - passedCount(a) || bestScore(b) - bestScore(a) || Number(a.unmeasured) - Number(b.unmeasured) || a.modelId.localeCompare(b.modelId)` ✓
  → ① passed 수↓ ② 최고 점수↓ ③ 미측정 행 아래 ④ 모델명↑ ✓.
- 기존 `tier`(오케→워커→나머지)·`scoreNum` 규칙 제거 ✓ → **행 순서만** 바뀜 ✓ (데이터·점수·파레토 계산 불변 ✓).

`src/insights/letter-markdown-free.ts`:
- 정렬 각주 갱신 ✓: `- 정렬: 오케 통과 → 워커 통과 → 나머지, 각 점수 내림차순 · 동점 모델명.` → `- 정렬: 역할 점수 보유 수↓ → 최고 점수↓ → 모델명.` ✓.

## 2. 항목별 확인

| 항목 | 결과 | 근거(실측) |
| --- | --- | --- |
| ① passed 역할 수 desc | PASS | `passedCount` 비교가 1순위 ✓ (deepseek 3 > minimax 2 ✓) |
| ② 최고 표시 점수 desc | PASS | `bestScore` 비교가 2순위 ✓ (glm 66.1 > mimo 59.8 ✓) |
| ③ 모델 id asc | PASS | 최종 비교 `modelId.localeCompare` ✓ (동률 'a' < 'b' ✓ 테스트 ✓) |
| ④ 점수 없는 미측정 행 마지막 | PASS | `unmeasured` 플래그 비교가 모델명보다 앞 ✓ (실측: aaa-unmeasured 가 마지막 ✓) |
| 모델명 하드코딩 없음 | PASS | `grep -E "deepseek\|minimax\|glm\|mimo\|claude\|gpt-"` on 두 모듈 → **0건** ✓ |
| 기대 순서(deepseek→minimax→glm→mimo→미측정) | PASS | 실측: `deepseek-v4-1-flash → minimax-m3-1-flash → glm-5-3-flash → mimo-v2-6-flash → aaa-unmeasured` ✓ (passed 수 3/2/1/1/0 ✓) |
| 정렬 각주 갱신 | PASS | `- 정렬: 역할 점수 보유 수↓ → 최고 점수↓ → 모델명.` ✓ (테스트 갱신 ✓) |
| 점수·순위 계산 불변 | PASS | 정렬 함수만 변경 ✓ · 점수 모듈 무변경 ✓ |
| Free 열·댓글 수·publish 불변 | PASS | Free 열 구성·렌더 무변경 ✓ · 댓글 3개 ✓ · publish 계약 무변경 ✓ |
| 전체 check | PASS | **단위 1434/1434 · BDD 45 시나리오/635 스텝 · typecheck·build EXIT=0** ✓ (로그 `tmp/yoroi-246-free-sort-check.log`) · validate-repo exit 0 ✓ · diff-check clean ✓ · 파일 100줄 이하 ✓ |

## 3. 관찰 (차단 아님)

1. **"미측정" 판정 기준이 두 가지** — 구현은 `FreeRow.unmeasured` 플래그(미측정 Free 목록에서 온 행 ✓)를 쓴다 ✓.
   역할 목록에서 왔지만 통과한 역할이 없는 행(모든 셀이 '✗' ✓)은 플래그가 없어 `bestScore = -Infinity` ✓ 로 미측정 행과 동점 처리 후 **모델명 순**으로 온다 ✓.
   → "점수가 하나도 없는 행"을 전부 마지막으로 내리려면 `bestScore === -Infinity` 기준을 쓸 수도 있다 ✓ (기준 문서의 ④ 표현과 미세하게 다름 ✓ · 현행 유지 판단 ✓).
2. **"최고 표시 점수"는 passed 셀만** — '✗' 로 표시되는 셀도 내부적으로는 점수 문자열을 갖지만(표시는 '✗' ✓), 구현은 passed 셀의 최고만 비교 ✓.
   표시 기준(읽히는 숫자)으로는 일관 ✓ · 내부 점수로는 '✗' 행의 점수를 무시 ✓ → 관찰 ✓.
3. **정렬 각주 문구** — '역할 점수 보유 수↓ → 최고 점수↓ → 모델명' 은 '미측정 행은 아래' 를 명시하지 않는다 ✓ (각주 축약 ✓ · 필요 시 보완 여지 ✓).

## 4. 재발행 위험

1. **Free 표 행 순서**가 deepseek → minimax → glm → mimo → 미측정 으로 바뀌는지 확인 ✓ (실사용 가능 모델 상향 ✓).
2. **행 안의 값(점수·AA 지수·Zen/Go·비고)** 은 정렬로 바뀌지 않음 ✓ → 셀 정합 확인 ✓.
3. **댓글 3개·본문 3섹션·Free 8열·실사용 열** 동시 확인 ✓.
4. **정렬 각주 문구**가 새 기준과 일치하는지 확인 ✓ (오래된 기준 문구가 남으면 혼선 ✓).
5. **미측정 행이 여전히 마지막**인지 확인 ✓ (플래그 기반 ✓).
