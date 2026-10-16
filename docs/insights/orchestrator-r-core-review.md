# R core 교차리뷰 (w1, 2026-10-16)

- 범위: w2 core(code/config/tests) 실제 diff 기준 독립 검토. w2 소스는 read-only, 내 렌더 구현은 리뷰에서 제외.
- 소유: `tests/helpers/dimension-reference.ts`(오케 I²→I 정정)·본 문서·보고 JSON.
- 판정: **core 계약충족 / helper 정정으로 dimension-contract 3실패 해소 / stale 주석 3건만 경미 지적.**

## 계약 검증 (w2 core diff)

| 계약 | 근거(file:line) | 판정 |
| - | - | - |
| R70/5/10/15 합1 | config/score-weights.json `.70/.05/.10/.15`(합1.00), score-weights.ts defaults 동일 | ✅ |
| 워커 30/20/10/40·가산5 불변 | config·defaults `.30/.20/.10/.40`, WORKER_BONUS_CAP 5, score.ts:65-66 가산=cap×mean | ✅ |
| valueForMoney=I/(P+.01) | score-policy.ts:33-34 `intelligence/(price+0.01)` (제곱 없음) | ✅ |
| log10 유지 | score.ts PARTS orchValue `Math.log10`, cogCost `safeLog` | ✅ |
| Cog 역방향 소스별minmax max | score.ts PARTS cogCost `low:true`, :54 `v>dims[dim]`→max, :19 price ['aa','cognition'] | ✅ |
| 오케 2leg(정·역방향) | score.ts PARTS orchValue 정방향 + cogCost 역방향, orchValue=score-raw:64 | ✅ |
| dirty effort hunk 보존 | score-raw:59-64 오케 at(effort)+orchValue, 워커 aaSpeed max·aaPrice min·aaCpt/aaTotal min | ✅ |
| Grok 쌍불변 | filter.ts:48 SEPARATE_PAIRS ['grok-4-6','grok-4-7'], 필터/Grok 테스트 11/0 | ✅ |
| ROLE_WEIGHT_DIMENSIONS 4차원 | score-weights.ts orchestrator ['performance','usage','speed','price'] | ✅ |

## helper 정정 (내 소유)

- `dimension-reference.ts:64` 오케 aaPrice(가성비) leg만 `Math.log10(I ** 2/(v+.01))` → `Math.log10(I / (v+.01))`.
- 워커 leg(`Math.log10(v+.01)`)·전체 워커 계산(aaPrice/aaCpt/aaTotal min·cpt·total 평균·가산·하한33) **불변 확인**.
- 결과: `tests/insights-dimension-contract.test.ts` **8 pass/3 fail → 11 pass/0 fail**.

## ROLE_DIMENSION_LABELS 재export 주장 정정

- 직전 렌더 패킷에서 "core 재export 필요"를 의존성으로 주장했으나, **불필요로 정정**.
- 근거: 렌더는 `letter-markdown-format.ts`에 ROLE_DIMENSION_LABELS를 지역정의해 자족하고,
  `pnpm typecheck`(tsc --noEmit) **에러 0** — core가 이 심볼을 export하지 않아도 컴파일·동작함.
- 즉 core 재export는 선택적 마이그레이션이지 차단 의존성이 아님.

## w2 소스 발견 버그 (수정 안 함 — 근거만)

1. `src/insights/letter-top10-score-policy.ts:11` 주석: "성능 82%·사용량 6%·속도 12%…(가성비 제거)" — 실제 R값 .70/.05/.10/.15·가성비 복구와 모순(레거시 p75 문구).
2. `src/insights/letter-top10-score-raw.ts:56` 주석: "오케 가성비 제거, 단가는 파레토·표시용" — 가성비 복구 후 부정확.
3. `src/insights/letter-top10-score.ts:68` 주석: "오케 가격 차원 없음" — 오케는 현재 가성비 price 차원 존재.

## 테스트 상태

- dimension-contract 11/0 · c-policy+effort+source-policy 17/0 · filter+grok 11/0 · 전체 insights **472 pass/3 fail**.
- 실패 3건 전부 compact 3800-char 예산(`composition compact`·`worst-case compact`·`renderTop10Letter compact`) —
  지시대로 **범위 밖 후속**, 여기 수정 안 함(오케 4번째 열로 compact 길이 증가와 관련 있을 수 있으나 별도 이슈).

## 검증

- `validate-repo` PASS(643 files). helper 100행 유지. 코드·버전·git·원격·레터 발행 0건, 신규 API 호출 없음.
