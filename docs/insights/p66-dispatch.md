# p66 분배 (2026-10-14 사용자 결정)

가중치 숫자는 재검산 전이라 바꾸지 않는다. 가성비 결합은 채택 확정이다.

## 확정

- (a) AA `I²/(P+0.01)` 와 (b) Cognition USD/task 를 소스별 min-max 후 차원 max로 결합한다. (a)는 높을수록, (b)는 낮을수록. 원값을 더하지 않는다.
- 단독 (a)·(b)는 참고만. 제품·테스트·`docs/insights/score-weights.md`·`docs/insights/four-source-score.md`에 결합과 단위(USD/1M vs USD/task)를 적는다.
- `config/score-weights.json`의 오케 70/0/15/15·워커 30/20/10/40은 유지한다.

## 민감도 격자 (w1 계산, w3 일부 대조)

- 성능 {60, 65, 70, 75, 80, 85, 90, 95, 100}. 사용량 0. 나머지는 속도·가성비.
- 배분 3축: 균등, 속도 2/3, 가성비 2/3. 성능 100은 한 칸. 70/0/15/15를 반드시 포함한다.
- 칸마다: Top3가 70/0/15/15 칸과 같은지, 대표 effort의 medium·high·max 비중, 비허용 max 건수(flash/free·free접근·혼합단가≤0.50 제외), 임계 통과 수.
- 70/0/15/15가 이웃보다 Top3가 갈리거나 비허용 max가 늘면 구조가 깨진 것으로 적고 대안 칸만 제안한다. 파일 값은 바꾸지 않는다.
- 입력은 현재 DB. 2026-10-13 사본으로 꾸미지 않는다. 실 API 금지.

## 담당

| 라벨 | 범위 | 보고 |
| --- | --- | --- |
| w2 | 결합 확정을 제품·문서·테스트에 반영. 가중치 숫자 불변 | `scratch/reports/yoroi-p66-w2-report.json` |
| w1 | 격자 표·70칸 요약·참고 순위 정리·주 보고 append | `scratch/reports/yoroi-p66-w1-report.json` |
| w3 | 70·65·75 균등 칸만 독립 대조. 제품·주 보고 금지 | `scratch/reports/yoroi-p66-w3-report.json` |
| w4 | w2 리뷰. 재구현 금지. 깨짐은 메신저 전달용으로만 정리 | `scratch/reports/yoroi-p66-review.md` |

주 보고는 w1만. 100줄 넘으면 `scratch/reports/p66-sensitivity.md`로 분리하고 포인터. 커밋·모델 변경 금지.
