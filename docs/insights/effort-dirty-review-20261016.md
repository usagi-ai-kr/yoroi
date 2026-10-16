# 미커밋 effort 변경 판정 (w1, `yoroi-effort-dirty-w1`, 2026-10-16)

- 대상(읽기 전용): `letter-top10-score.ts`·`four-source-score.md` 미커밋 diff, `tests/insights-worker-effort-source.test.ts`(untracked).
- 기준: main에 머지된 `aba39d9`(1.0.3 — 워커 effort 라벨을 실제 사용한 AA 값의 변형과 정합) · HEAD `f72a404`.
- **판정: 3건 모두 중복 — 별도 커밋 불요.** 소스·테스트 수정 없음(원본 보존).

## 1) `src/insights/letter-top10-score.ts` — 중복(의미 동일)
- HEAD(머지본): `effort = r.aaEffort?.has(chosen) ? chosen : best(r.aaEffort)?.[0] ?? chosen` (1줄 인라인).
- 미커밋: 같은 식을 `aaFallback = best(r.aaEffort)?.[0]` 지역변수로 분리(3줄) + 주석 이동.
- 동일 조건·동일 fallback 값 → **행동 차이 0**(effort·라벨 테스트 전부 PASS). 고유 보완 없음.
- **권고: 폐기**(다음 커밋 제외, 워킹트리 보존). 반영이 필요해도 주석 수준으로 충분.

## 2) `docs/insights/four-source-score.md` — 중복/일부 stale
- 워커 추천 effort bullet: 미커밋은 1.0.3 이전 문구("성능 차원을 낸 소스(동점 AA)의 최고 effort") — HEAD는 이미 라벨 fallback을 반영한 최신·정확 문구 → **미커밋 쪽이 stale**.
- 성능 row: 규칙 변화 없이 문구 명확화(워커=AA만, Cog 정답률은 가산 입력) 수준 — 정책 diff 0, 선택적 표현 개선.
- **권고: 폐기**(원하면 성능 row 문구만 수정 후 커밋 — 필수 아님).

## 3) `tests/insights-worker-effort-source.test.ts` — 중복(커버리지 포함됨)
- 케이스: Sol `medium` 유지(+`50.0`) / DeepSeek `high→max`(+`39.5`).
- 머지된 `tests/insights-worker-effort-label.test.ts`가 두 케이스 + AA 전무 케이스와 동일 단언(indexText 포함)을 이미 커버.
- 실행은 PASS지만 고유 커버리지 없음 → **폐기 권고**. 유지하려면 중복 사유 명시 필요.

## 실행·결과 (실패 없음)
- `tests/insights-worker-effort-source.test.ts`·`insights-worker-effort-label.test.ts`·`insights-letter-top10.test.ts` = **7/7 PASS** (dirty 워킹트리 기준).

## 결론
- 세 항목 모두 **중복 → 커밋하지 말 것**. 워킹트리 원본은 삭제·정리 없이 보존(통합 판단은 o/w2).
