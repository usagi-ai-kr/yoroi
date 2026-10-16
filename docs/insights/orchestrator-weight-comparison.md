# 오케스트레이터 가중치 후보 비교 (2026-10-16)

## Top10 행렬 (모델 effort 점수, JSON 기계 생성)

| 순위 | native 82/6/12 | R 70/5/10/15 | A 60/5/15/20 | B 55/5/15/25 | C 50/5/20/25 |
| --- | --- | --- | --- | --- | --- |
| 1 | opus medium 96.4 | opus medium 89.4 | opus medium 86.8 | opus medium 84.3 | opus medium 84.1 |
| 2 | sonnet xhigh 89.4 | sol-6.1 medium 82.7 | haiku max 82.1 | haiku max 83.0 | haiku max 82.7 |
| 3 | sol-6.1 medium 86.4 | sonnet xhigh 82.2 | sol-6.1 medium 80.8 | sol-6.1 medium 79.4 | sonnet high 79.8 |
| 4 | haiku max 78.1 | haiku max 81.4 | sonnet high 80.7 | sonnet high 79.3 | sol-6.1 medium 78.9 |
| 5 | muse max 74.9 | muse max 71.7 | luna max 69.9 | luna max 71.0 | luna max 68.8 |
| 6 | gpt-6-sol max 74.0 | luna max 71.0 | muse xhigh 68.7 | muse xhigh 67.5 | muse xhigh 67.1 |
| 7 | deepseek high 70.7 | gpt-6-sol max 68.7 | deepseek max 65.2 | deepseek max 65.8 | deepseek max 65.2 |
| 8 | grok-4-7 high 70.7 | deepseek high 68.2 | glm-flash max 64.3 | glm-flash max 65.6 | glm-flash max 62.5 |
| 9 | grok-4-6 high 69.7 | mimo-pro default 67.6 | mimo-pro default 64.0 | mimo-pro default 64.2 | mimo-pro default 60.4 |
| 10 | luna max 66.8 | grok-4-7 high 66.7 | gpt-6-sol max 62.9 | mimo-flash default 61.6 | mimo-flash default 58.9 |

- 범례: opus·sonnet·haiku = Claude 5.5 계열, sol-6.1 = gpt-6-1-sol (gpt-6-sol과 독립), luna = gpt-6-luna, muse = muse-spark-1-3, deepseek = deepseek-v4-1-flash, glm-flash = glm-5-3-flash, mimo = 2.6 계열(pro·flash).

## 진입·이탈 (native 대비)
- R: mimo-pro 진입·grok-4-6 이탈 (1교체). 4-7은 ▽10 잔류.
- A: +glm-flash 진입·4-7 이탈 (2교체). B: +mimo-flash·gpt-6-sol 이탈 (3교체).
- C: B와 소속 동일·순서만 변경. grok 전체 순위: native 8·9위 → R 10위·밖 → A·B·C 밖.

## effort 변화 (계속 소속 3종 + 신규 구분)
- R: 변화 0. A·B·C: sonnet·muse·deepseek 3종 (신규 진입 glm-flash·mimo-flash와 구분).

## 기여 분석 (UI 0..100 = 가중치×원시×100)
- haiku 가격 기여: R 15.0·A 20.0·B 25.0·C 25.0 (원천 AA). luna B 23.5 (AA).
- AA V는 I²/(P+.01) 포함이나 Cog V는 USD/task이므로 기여 증가를 지능만의 결과로 단정 못함.
- Opus는 P 99.1·S 95.7이 둘다 높아 전 후보 1위. 가성비 V 49.6은 별도 원천 Cog다.

## 메타·보존
- ▽는 최고점 대비 85% 상대 판정이다 (절대 최적 표시 아님).
- 워커 6 case 불변. control=native. Free는 fresh 대조군(원본 아님). 제품 미적용, 1.0.x 선택 대기.
