# R 핵심 복구 (1.0.2, 2026-10-16)

## 변경 5종
- `config/score-weights.json`: 오케 70/5/10/15. 워커·cap 불변.
- `score-weights.ts`: 로더 오케 price 키·합 1, 기본값 R.
- `score-policy.ts`: 오케 price `['aa','cognition']`, `valueForMoney` 선형 I/(P+.01) (p70 I²에서 변경).
- `score-raw.ts`: `orchValue` + 변형별 연동.
- `score.ts`: 오케 price 2 leg (AA log10 정방향·Cog 역방향, 차원 max).

## 보존
- 워커 30/20/10/40·가산·dirty effort hunk·테스트 그대로.
- 렌더러·문서·버전 무변경.

## 검증
- typecheck PASS, 소유 테스트 12/12 (c-policy 4·weights 5·value 3).
- 전체 1024 중 30 실패 — p75 구정책 비소유 12파일, 후속 소유로 정정 필요.
- 릴리스 기준: main `69889876`.
