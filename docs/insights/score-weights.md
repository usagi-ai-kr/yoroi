# 점수 가중치 외부 설정 (config/score-weights.json, p65 2026-10-14)

- 경로·키: 저장소 루트 `config/score-weights.json`. 최상위 `orchestrator`·`worker`, 각 아래 `performance`·`usage`·`speed`·`price`.
- 저장소 기본값(p70 확정): 오케 0.70/0.05/0.10/0.15, 워커 0.30/0.20/0.10/0.40. **파일이 없으면 이 기본값**을 쓴다.
- 값 오류는 조용히 무시하지 않고 예외로 멈춘다: JSON 파싱 실패, 모르는 역할·차원 키, 역할·차원 누락, 숫자 아님, 음수, 역할별 합 ≠ 1(허용오차 1e-9).
- 로더: `src/insights/letter-top10-score-weights.ts`(`loadScoreWeights`·`validateScoreWeights`·`SCORE_WEIGHTS`).
  정책 상수 `ROLE_DIMENSION_WEIGHTS`(`letter-top10-score-policy.ts`)가 코드 리터럴이 아니라 이 값을 그대로 쓴다.
  스코어·레터 표시 문구가 같은 값을 본다.
- 바꾸는 방법: 파일 숫자만 고친다. 코드에 숫자를 복사하지 않는다. 지금은 파일 값=기본값이며 사용자가 확정하기 전까지 바꾸지 않는다.
  `tests/insights-score-weights.test.ts`가 파일 값=기본값, 파일 없음=기본값, 잘못된 값 예외, 로더 사용을 고정한다.
- 형식 근거(사용자 결정): 2역할×4차원 표는 환경변수로 읽기 어렵고 YAML은 새 의존이라 JSON을 쓴다.
- **오케 가성비 결합(p66 사용자 확정)**: (a) AA `I²/(P+0.01)`(USD/1M 혼합단가 기반, 높을수록)와 (b) Cognition `cognition_cost`(USD/task, 낮을수록)를
  택일하지 않고 **소스마다 min-max 표준화한 뒤 차원 max**로 합친다. 단위가 다른 원값(USD/1M vs USD/task)을 더하거나 한 척도로 섞지 않는다.
  `sources`에는 `price:aa`·`price:cognition` 두 키가 남고, 차원 값은 둘 중 큰 표준화 값이다. 단독 (a)·(b) 순위는 w1 참고 보고서에만 쓴다.

## 오케 usage 0.05 vs 워커 usage 0.20 해석 차이 (p67 해석, p70 확정)

- 워커 0.20: 성능 하한(≥0.70)을 통과한 모델들 사이의 **주요 선택 근거**다. 실행 역할은 같은 성능대에서 사용량(OR·OCD 토큰)이 적은 쪽을 고르는 것이 목적이다.
- 오케 0.05: 판단·계획 역할에서는 사용량이 **판단 성능을 뒤집지 않는 가벼운 조정**으로만 쓰인다. 성능 70%를 유지한 채 나머지 30%를
  사용량·속도·가성비에 5/10/15로 나눠, 같은 판단 성능대에서 싸고 빠르고 가벼운 쪽을 소폭 우대한다.
- 소스는 두 역할 모두 OR·OCD 토큰으로 같다(`ROLE_SOURCES`의 `usage` — p70에서 오케도 켰다). 다른 것은 가중치와 역할 목적뿐이다.
- 상태: p70 확정으로 오케 usage 0.05를 켰다(파일·코드 기본값 동일). 숫자 변경은 사용자 결정으로만 한다.
