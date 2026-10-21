# 역할 적합성 의견 주석 이동 — 최종 독립 리뷰 (2026-10-21, w3)

- 리뷰 대상: w1 구현 보고서 `tmp/yoroi-role-fit-footnotes-impl-report.json` (status implemented-pending-review).
- 리뷰 방식: 읽기 전용 실제 diff 대조 + 독립 테스트 실행 + 전체 검증 대조. **소스 수정 없음.**
- 최종 판정: **PASS**

## 1. 요구 계약 대조 (docs/insights/role-fit-footnotes-20261021.md)

| 요구 | 결과 | 근거 |
| --- | --- | --- |
| 3역할 표를 5열(순위·파레토·모델·스코어·effort)로 변경 | PASS | `letter-three-role-render.ts` — `tableHead` 5열, `rowFor` 5칸(비고 열 제거) |
| 의견은 각 표 바로 아래 `> 모델명: usagi 기호 · 의견` 형식 | PASS | `footnotesFor` 가 `> ${name}: ${note}` 생성, `renderThreeRoleSection` 이 표 행 뒤 `''`+주석으로 배치 |
| 표시된 모델만·모델당 1회·표 순서 유지 | PASS | 표에 그려진 `rows`(=depth 절단 후)만 순회, `seen` 집합으로 모델당 1회, 순서 유지 |
| 의견 없는 모델은 주석 생략 | PASS | `roleFitNote(...) === undefined` 이면 `continue` |
| 의견·출처·점수·순위 보존 | PASS | 주석은 `roleFitNote` 원문(usagi 기호+메모)만 사용, 스코어·effort·파레토 경로 무변경(`entry.isPareto`·`scoreCell`·`textCell(entry.effort)`) |
| Free 운영 비고 유지 | PASS | Free 표는 `letter-markdown-free-table.ts` 별도 경로 — 본 변경 없음 |
| 파레토 계산·정책 변경 금지 | PASS | 변경은 `letter-three-role-render.ts` 표시 계층뿐. `letter-top10-score.ts`·`letter-top10-worker.ts` 미변경 |

## 2. 독립 검증

- 집중 테스트(신규 `tests/insights-role-fit-footnotes.test.ts` 포함) **21/21 통과** — 이전 유닛에서 1회 실행, 본 리뷰에서 재확인.
- 전체 `pnpm run check`: **1383/1383 단위 + BDD 45 시나리오/635 스텝, EXIT=0** (로그 `tmp/role-fit-footnotes-final-check.log`)
  → w1 보고서의 1383/1383·45/635 주장과 **일치** ✓
- `python3 scripts/validate-repo.py` 위반 0건 / `git diff --check` 통과 / 변경 파일 100줄 이하
- stale 픽스처 갱신 2곳 확인: `insights-letter-three-role-render.test.ts`(5열 머리·행 셀), `insights-model-role-fit.test.ts`(주석 계약)

## 3. 경합·잔여

- 리뷰어 파레토 공백은 **별개 미결**(계산·전달 누락, `docs/insights/reviewer-pareto-audit-20261021.md`). 본 변경과 경합 없음(파레토 기호는 기존과 동일 경로 ✓).
- 주석은 "표시된 행" 기준이므로 본문 Top7 과 댓글 Top15 의 주석 집합이 다를 수 있다(의도된 계약 ✓).
- usagi 관찰은 정성(점수 아님) — 범례 문구는 기존 유지 ✓.

## 4. 커밋 범위(경로 지정)

포함: `src/insights/letter-three-role-render.ts` · `tests/insights-letter-three-role-render.test.ts` ·
`tests/insights-model-role-fit.test.ts` · `tests/insights-three-role-display.test.ts` ·
`tests/insights-role-fit-footnotes.test.ts` · `docs/insights/role-fit-footnotes-20261021.md`(요구) ·
`docs/insights/role-fit-footnotes-result-20261021.md`(결과) · `docs/insights/role-fit-footnotes-review-20261021.md`(본 리뷰)

제외: `docs/insights/next-*` 감사 문서 3종 · `docs/insights/free-score-audit-20261021.md` ·
`docs/insights/reviewer-pareto-audit-20261021.md`(파레토 진단) · 그 밖 미커밋 변경 전부

push·외부 쓰기(이슈·댓글·PR·레터) 없음.
