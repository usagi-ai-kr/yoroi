# R 렌더 복구 (w1, 2026-10-16)

- 지시: `orchestrator-r-release-task.md` + 패킷 `yoroi-r-render-w1`. w2 core 복구와 동시 진행.
- 핵심 정정: 가성비 공식은 **I/(P+0.01)**(제곱 제거, log10 유지), NOT I². 임시 R 시뮬레이션(I²)과 구분.
- 코드·config·score·버전·git·원격·레터 발행 없음. 렌더·테스트·docs만 소유 파일 내 수정.

## 소유 파일·변경

| 파일 | 변경 |
| - | - |
| `letter-markdown-format.ts` | 오케 price 라벨 `가성비` 지역정의(ROLE_DIMENSION_LABELS), weightsText·공식줄에 가성비 I/(P+.01)·Cog 복구 |
| `letter-top10-legend.ts` | dimensionsLabel/Text 오케 4번째 `가성비` 반영, 범례에 가성비 소스 AA·Cog·결측0, 오케 `*` 대체 제외 |
| `letter-markdown.ts` | 자격 문구 `네 차원` 복구 |
| `letter-top10-unified.ts` | 가성비 4번째 열은 dimensionsText로 이미 채워짐 — 불변(costEffRankText 선택이라 생략) |
| `tests/insights-dimension-contract.test.ts` | ROLE_W·가중치 deepEqual R(70/5/10/15), 가성비 불변식 테스트를 '가성비 반영'으로 교체, source max·워커/Grok 불변 유지 |
| `tests/insights-orchestrator-value-render.test.ts` | 신규: 오케 4차원열·가성비 라벨·공식문구 의미검증 |

## 렌더 계약 (R70/5/10/15)

- 오케 표: 성능/사용량/속도/**가성비** 4열. `displayDimensions(orchestrator)`가 price(0.15>0) 포함 → 4차원.
- 워커 표: 성능/사용량/속도/가격 4열(사용량 실가중 0.20)·가산, 불변.
- 가성비 소스: 오케 `ROLE_SOURCES.orchestrator.price=['aa','cognition']` — AA I/(P+.01) 정방향 + Cog USD/task 역방향, 소스별 log min-max 후 차원 max, 결측 0.
- 공식줄·범례에 위 정의 노출.

## 검증

- `tests/insights-orchestrator-value-render.test.ts`: **5/5 pass** (라벨·4열·공식 I/(P+.01)·Cog·결측0).
- `tests/insights-dimension-contract.test.ts`: **8 pass / 3 fail**.
  - 통과: 가성비 소스 max 반영, I=0·무가격 가성비 0, 관측가격 반영, 워커 가중치 70/5/10/15·source max·워커 하한·Grok 불변.
  - 실패 3건 = 전부 참조헬퍼 I²→I **의존성**(ref-대조 `near`).

## 소유권 아닌 파일 의존성 (w2·리뷰어 몫)

1. `tests/helpers/dimension-reference.ts`(비소유): 오케 가성비 `log10(I²/(P+.01))` — 정정 계약 `I/(P+.01)`과 불일치.
   선형화해야 dimension-contract ref-대조 3건 통과.
2. `letter-top10-score-policy.ts`(비소유): `ROLE_DIMENSION_LABELS` 미export — 렌더이 지역정의로 대체. core 재export 시 이관.
3. `tests/insights-markdown-legend.test.ts`(비소유): 내 렌더 복구로 오케 3→4열('90/70/60'→'.../80'),
   '오케 6%'→'5%', 가성비 범례줄 추가 → 소유자 갱신 필요(의존성).
