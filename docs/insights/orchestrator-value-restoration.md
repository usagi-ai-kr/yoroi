# 오케스트레이터 가성비 복구 공식 매핑 (p70, 2026-10-14)

## 확정 공식 (e05522c, b408803 제거 전)
- AA: `orchValue = I²/(P+0.01)` → log10 → min-max (높을수록). I=대표 effort AA Intelligence, P=같은 effort 혼합 단가 **USD/1M** (USD/task 아님).
- Cog: `cogCost` USD/task → log10 → min-max 역방향 (낮을수록).
- 차원 = 두 표준화값의 max. 단위를 섞지 않는다. I·P 결측→0, 오케 결측 보정 0.
- effort 연동: 관측 effort 변형마다 그 effort 값으로 채점 후 최고점 변형이 대표 (p58).

## I² 주의 (공식 확인됨)
- 성능 직접 가중치를 낮춰도 지능 I가 가성비 채널(I²/P)로 남는다. 후보 비교 시 함께 본다.

## 현 dirty 구분 (원본 무수정)
- `letter-top10-score.ts`·`four-source-score.md` diff는 워커 effort 선택뿐, 오케 경로 무변경.

## 격리 복구 최소 경로 (c7 clean, temp only)
1. `config/score-weights.json`: 오케 price 키 복구 (grid별 70/60/55/50 외 값, 합 1±1e-9 검증).
2. `score-policy.ts`: `valueForMoney`·`ROLE_SOURCES` 오케 price `['aa','cognition']`·라벨 가성비 복구.
3. `score-raw.ts`: `Raw.orchValue` 수집 + effort 동일 연동 복구.
4. `score.ts`: 오케 price 2개 leg + 차원 max (공통 로직 재사용).
5. 렌더·라벨: 차원 열·수식·자격 문구의 가성비 표기 복구.

## 후보 grid (합 100 확인)
- p70 70/5/10/15 · A 60/5/15/20 · B 55/5/15/25 · C 50/5/20/25. 사용량 5% 고정.
