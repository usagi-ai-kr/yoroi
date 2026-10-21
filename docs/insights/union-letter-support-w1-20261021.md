# #266 DELTA 구현 기록 — 워커 Free ≥1 (w1, 2026-10-21)

- 소유 이전: w2(p4) → w1(p2). w2는 레터 수정 금지. 이전 검증은旧 상태로 구분.
- 확정 정책: best/open 두 정책 × 1+1+3·1+2 모두 워커 ≥1 verified Free.
  나머지 Free 배제·Beam 강제·O 강제 없음. O/R/나머지는 자연 합산 최대.
- 커밋·push·PR·발행 금지. 0.3.x·Postgres 중단, 0.2 레터 집중.

## 1. 구현 (코드·테스트만, Top7/표/댓글/publish 불변)

- `src/insights/letter-team-runners.ts` (+10): `isFreeCandidate`(fallback 표시·canonical 매칭),
  `freeWorkerNeed`(키 없거나 비면 미적용·측정 우선·미측정 fallback 허용·없으면 불가 판정).
- `src/insights/letter-team-combinations.ts` (99줄): `verifiedFreeKeys` 입력,
  `bestPlan` 전수 탐색에 워커 쿼터 조건, 불가 시 `Free 워커 후보 없음` 명시.
- `src/insights/letter-three-role-pipeline.ts` (99줄): `freeCatalogModelIds` →
  canonical 키 집합 → 4조합에 전달. composition은 기존 전달 그대로(무수정).
- `tests/insights-team-free-slot.test.ts` (73줄, 신규 7건): 4조합 보장·측정 우선·
  Beam 미강제/무점수·후보 없음 명시·레거시 무키 동작 유지·O 강제 없음.
- 기존 테스트 무수정: 키를 안 주면 기존 동작 그대로(하위 호환).

## 2. 실제카탈로그 회귀 (`officialFreeListing` 정적 스냅샷 14+3, verified 17, Beam 포함)

- 시나리오 1(현실 점수): 전/후 동일 — 측정 Free(mimo·minimax)가 이미 최상위라
  쿼터가 자연 충족. 4조합 워커에 Free 포함, GLM-5.3 선발(O/R 점수), Beam 미등장.
- 시나리오 2(Free 저점수): 쿼터 작동. best-1+1+3 합산 344.8→307.8(muse→mimo 교체),
  best-1+2는 O까지 glm→gpt로 재배치해 제약 하 최대(225). open-1+2도 mimo 편입.
  전 조합 feasible, Beam 미등장(측정 Free로 충족 — 강제 없음), 점수 조작 없음.
- 동일 실체 중복 없음·1+2 리뷰어 없음 유지.

## 3. 최종 검증 (w1)

- `pnpm run check` EXIT=0: 단위 1471/1471 (기존 1464 + 신규 7) ·
  BDD 45/45 시나리오·635/635 스텝 · typecheck·build 통과.
- `validate-repo.py` 위반 0건 · `git diff --check` clean · 시크릿 노출 없음.

## 4. r 전달

- r은 본 문서 + 보고서 + diff로 최종 독립 리뷰. 큰 문제 없으면 o가 dev→main PR.
  WIP 미커밋 유지.
