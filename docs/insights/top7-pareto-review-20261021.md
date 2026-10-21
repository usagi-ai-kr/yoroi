# Top7 파레토 열 제거(#245) 독립 리뷰 (2026-10-21, w3)

- 범위: w1 의 #245 구현(3역할·2역할 역할 표의 **Top7 파레토 열 제거**)을 **실제 diff·실행으로** 독립 리뷰 ✓.
  읽기 전용 — 코드·테스트 미수정 ✓ · 커밋·push·발행·외부 쓰기 0건 ✓.
- **종합 판정: PASS** (BLOCK 0건) — Top7 5열(파레토 없음) · Top15 6열(파레토 유지) · Free·점수·순위·댓글 수 불변 ✓.

## 1. 실제 변경 (diff 대조)

`src/insights/letter-three-role-render.ts`:
- `withPareto = depth === 15` ✓ → Top7(7) 은 5열 `| 순위 | 모델 | 스코어 | effort | 실사용 |` ✓ · Top15(15) 는 기존 6열 `| 순위 | 파레토 | 모델 | 스코어 | effort | 실사용 |` ✓.
- `rowFor`·`tableHead` 를 조건부로 분기 ✓ · `entry.isPareto` 데이터는 그대로(계산·보존 ✓).

`src/insights/letter-markdown-tables.ts`:
- `columns(role, withPareto = true)` / `tableHead(role, withPareto = true)` ✓ · 파레토 열을 조건부로 삽입 ✓.
- `renderRoleTable(..., withPareto = rowLimit !== 7)` ✓ → 본문 Top7 호출(rowLimit 7 ✓)은 파레토 없음 ✓ · 댓글 Top15 호출(기본 Infinity ✓)은 유지 ✓.
- 호출처는 4곳뿐(`letter-markdown.ts` 51·52·57·58 ✓) → 의도 외 영향 없음 ✓.

테스트: `insights-letter-three-role-render`(Top7 5열·Top15 6열·행 형식) ✓ · `insights-letter-parts`(본문/댓글 비교를 **머리 기준 컬럼 인덱스**로 변경해 열 차이에 resilient ✓) · `insights-markdown`·`insights-model-role-fit`·`insights-top10-source-policy`(열 제거에 맞춘 기대값) ✓.

## 2. 항목별 확인

| 항목 | 결과 | 근거(실측) |
| --- | --- | --- |
| 3역할 본문 Top7 = 5열·파레토 없음 | PASS | `| 순위 | 모델 | 스코어 | effort | 실사용 |` ✓ · 본문에 👍 셀 0 ✓ |
| 3역할 Top15 댓글 = 6열 유지 | PASS | `| 순위 | 파레토 | 모델 | 스코어 | effort | 실사용 |` ✓ |
| 2역할 본문 Top7 = 파레토 없음 | PASS | `| 순위 | 모델 | 추천 effort | 스코어 | 성능/속도/가성비 | AA 지수 | 혼합 단가 | 변동 |` ✓ · 본문 👍 셀 0 ✓ |
| 2역할 Top15 댓글 = 파레토 유지 | PASS | `| 순위 | 파레토 | 모델 | … |` ✓ |
| Free 표 비고 `👍 파레토` 불변 | PASS | Free 비고에 `👍 파레토` 존재 ✓ · Free 모듈(`letter-markdown-free*`) 무변경 ✓ |
| 점수·순위 불변 | PASS | 렌더는 열만 분기(데이터·계산 불변 ✓) · `isPareto` 보존 ✓ |
| 댓글 수 3 유지 | PASS | 실측 `comments.length = 3` ✓ · publish 계약 무변경 ✓ |
| Free 열 불변 | PASS | 2역할 7열 / 3역할 8열 그대로 ✓ |
| 전체 check | PASS | **단위 1432/1432 · BDD 45 시나리오/635 스텝 · typecheck·build EXIT=0** ✓ (로그 `tmp/yoroi-245-top7-pareto-check.log`) · validate-repo exit 0 ✓ · diff-check clean ✓ · 파일 100줄 이하 ✓ |

## 3. 관찰 (차단 아님)

1. **판정 기준이 매직넘버** — 3역할은 `depth === 15` ✓, 2역할은 `rowLimit !== 7` ✓. 본문 Top7 규칙이 바뀌면(예: Top5) 2역할만 파레토가 되살아나고 3역할은 5열 유지로 어긋난다 ✗ → 두 경로의 기준을 한 곳으로 모으는 개선 여지 ✓ (본 단위는 무변경 ✓).
2. **본문에서 파레토 정보가 사라짐** — Top7 본문에는 이제 파레토 표시가 없어 "앞으로 무엇을 고를지" 힌트가 줄 수 있다 ✓ → Top15 댓글에 유지 ✓ · Free 비고 `👍 파레토` 유지 ✓ → 의도된 절약 ✓.
3. **2역할 compact 미리보기** — compact 은 별도 렌더 경로(`renderTop10FromRecords`) ✓ → 본 compact 변경 여부는 별도 확인 필요 ✓ (본 diff 는 해당 경로를 건드리지 않음 ✓).

## 4. 재발행 위험

1. **본문 3역할 표가 5열**(파레토 없음)인지, **댓글 Top15 가 6열**(파레토 있음)인지 동시 확인 ✓ — 두 축이 갈라지므로 혼동 주의 ✓.
2. **2역할 경로**(3역할 off)도 본문 파레토 없음 ✓ · 댓글은 유지 ✓.
3. **Free 표는 8열·비고 👍 파레토 유지** ✓ → 본문 변경이 Free 표로 새지 않았는지 확인 ✓.
4. **댓글 3개·점수·순위 불변** ✓ · 각주(usagi 실사용 표식·의견) 유지 ✓ → 3역할 각주가 표 아래에 그대로 붙는지 확인 ✓.
5. `tests/insights-letter-parts.test.ts` 가 머리 기준 비교로 바뀌었으므로, 이후 열 개수가 또 바뀌면 머리 파싱이 영향받음 ✓ (관찰) ✓.
