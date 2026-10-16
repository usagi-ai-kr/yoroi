# DeepSeek Effort 소스 불일치 독립 교차 판정 보고

## 1. 판정 요약 및 결론
- **판정 결과**: **(B)가 정확한 사실임이 코드 라인과 데이터 추적으로 완전 증명됨.**
- 워커의 실제 성능 차원(`dims.performance`)은 **100% AA-only**(`score.ts:53`)로 산출되며, 채점에 쓰인 AA Intel 39.5와 표시 지수는 AA `(Max)` 레코드의 실측값입니다.
- 워커에 `high` 라벨이 붙은 것은 Line 42의 레거시 비교문(`c > a`)이 Cognition 표준값을 참조하여 라벨만 가져오고 실제 채점과 표시값은 AA Max를 쓰는 **라벨-데이터 소스 불일치(Source Effort Mismatch)**입니다.

## 2. 코드 및 숫자 추적 증명
1. **워커 채점의 AA-only 격리 (`score.ts:53`)**:
   - `if (role === 'worker' && p.dim === 'performance' && p.src === 'cognition') return;`
   - Cognition은 워커 성능 차원에 0% 반영되며, 오직 `bonus`(+4.4점, line 65)에만 들어감.
   - 워커 성능 30% 가중치 점수는 오직 `sources['performance:aa']` (AA Intel 39.5의 min-max = 0.6685, 20.05점)로만 계산됨.
2. **레거시 선택문에 의한 라벨 오염 (`score.ts:41-42`)**:
   - `const [perfAa, perfCog] = ...`
   - `m = c > a ? r.cogEffort : r.aaEffort;`
   - Cognition 표준값(0.7771)이 AA 표준값(0.6685)보다 커서 `r.cogEffort`가 선택되어 라벨이 `high`가 됨.
3. **표시 AA 지수 폴백 (`score.ts:71`)**:
   - `aa = r.aaEffort?.get('high') ?? best(r.aaEffort)?.[1]`
   - AA에는 `high`가 없으므로 `best(r.aaEffort)`인 **AA Max 39.5**로 폴백.
   - 결과: 표에는 `effort high`, `AA 지수 39.5`로 표기되나 AA에는 `high 39.5`라는 데이터가 존재하지 않음.

## 3. 오케스트레이터 vs 워커 차이점
- **오케스트레이터**: 전 변형 풀 평가에서 Cognition `high`가 70.43점으로 AA `max`(62.97점)를 이김. 성능(75)·속도(30)·가성비(53)가 모두 Cognition에서 와서 AA 지수가 `-`로 일관됨. 👉 **정상적인 점수 경쟁 결과**.
- **워커**: 성능·속도·가격·AA 지수 39.5가 모두 AA Max에서 왔음에도 라벨만 Cognition의 `high`를 차용함. 👉 **라벨-데이터 불일치**.

## 4. w1 후보 (`/tmp/yoroi-103-final-clean`) 최소 패치 평가
- **패치 내용 (`score.ts:43`)**:
  `const chosen = best(m)?.[0] ?? 'default', effort = r.aaEffort?.has(chosen) ? chosen : best(r.aaEffort)?.[0] ?? chosen;`
- **검증 결과**:
  - 워커 순위(4위), 스코어(59.3), 4대 차원(63/100/51/47), 가산(+4.4), 단가($0.26) **100% 동일** (Raw score 변동 0.0000).
  - 라벨만 실제 데이터 출처인 `max`로 정합성 회복 (AA Max 39.5와 effort max 일치).
- **권고**: 1.0.2는 현행 clean 동결 유지 후 주석/안내 부기, 1.0.3에서 w1 최소 1줄 패치 적용 권장.
