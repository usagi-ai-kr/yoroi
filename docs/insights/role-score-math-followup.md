# 정규순위 수학 후속 정리 (w3)

- 패킷: `yoroi-normal-math-notes-w3`. 근거 리뷰: `role-score-math-review.md`(F1–F3).
- 범위: 경미 사항 F2·F3 정리, F1 비차단 근거 기록. 실행 코드(함수·상수·규칙·모집단)는 변경 없음. 주석과 테스트 기대값만 변경.
- 소유: `src/insights/letter-score-normal.ts`, `tests/insights-score-normal.test.ts`는 w2→w3 이관(패킷). 이 밖의 source 편집 없음.

## F2: 정밀도 주석 정정 (완료)
- 전: `bisection(|오차|<=1e-12)`. 구간 분해능과 CDF 근사오차를 한 값으로 혼동.
- 후: 구간 분해능(부동소수점 수준, 약 1e-15)과 Φ⁻¹ 실제 오차(A&S erf 근사 기인)를 분리해 기술.
- 실측 근거(Python `statistics.NormalDist` 대비, |Δz|):
  - 0.01≤p≤0.99: 최대 1.4e-6 (p≈0.983)
  - p=1e-3: 2.0e-5 / p=1e-6: 2.5e-4 / p=1e-9: 5.8e-4

## F3: 자기참조 기대값 제거 (완료)
- 전: `inverseNormal(0.5 / 3)`, `inverseNormal(2.5 / 3)`처럼 모듈 자신의 함수로 기대값을 계산. 분위 정확도가 검증되지 않았다.
- 후: 고정 상수(Python `statistics.NormalDist`, 모듈 미호출).
  - zero 테스트 `[0,50,100]`: p=1/6 → 40.325784339, p=5/6 → 59.674215661
  - 동점 분위 신규 단언 `[0,0,0,0,100]`: 0 묶음 midrank p=0.4 → 47.466528969, 100은 p=0.9 → 62.815515655
- 허용오차 `SCORE_EPS=1e-4`(점수 단위). 실측 차이는 1.2e-7, 1.5e-6, 3.9e-6이라 여유가 25배 이상이다. 표시 기준 0.05의 1/500 이하다.
- 테스트 수 8 유지. 기존 `QUANTILE_EPS`와 분위 상수(1.959963985, 0.994457883)는 Python 값과 차이 1e-9 미만으로 일치해 그대로 둔다.

## F1: 비차단 근거 (코드 미변경)
- 현상: erf(0)=+1e-9(A&S 계수합 0.999999999). 중앙 분위에 ±1.25e-9(z) 오프셋, 점수로 1.3e-8 이하.
- 실측: `inverseNormal(0.5+4e-10)`=-2.5e-59 (Φ⁻¹ +1.003e-9), `inverseNormal(0.5+6e-10)`=+2.51e-10 (Φ⁻¹ +1.504e-9).
- 비차단 근거:
  1. 1자리 표시 반올림 반폭 0.05 대비 오프셋 1.3e-8은 약 4×10⁶배 작다.
  2. 값 하나가 반올림 경계를 넘을 확률은 약 20·δ ≈ 2.6e-7(δ=1.3e-8)이다. 후보 38개 기준 기대 변동은 1e-5 미만이다.
  3. 순위·동점에 영향 없음. 단조 역전 0(dense 8002점), 동점은 같은 p라 같은 점수다.
  4. p=0.5 결과는 점수 정확히 50(실측)이고, 전부 동점 50 규칙은 유지된다.
- 조치: 코드 변경 없음(패킷: 현재 코드에 필요 없는 개선 금지). 계수 정규화 같은 연속화는 필요 시 후속 과제로만 둔다.

## 소유권 상호 기록
- 수학 소스·테스트(`letter-score-normal.ts`, `insights-score-normal.test.ts`): 소유 w3(패킷 이관). w4는 수정하지 않는다. 수학 변경이 필요하면 coord를 거쳐 w3에 요청한다.
- 통합·NaN 표시 guard: w4(Luna)가 w1에서 인계받아 최소 보정 중이다. w3는 해당 통합·표시 파일을 편집하지 않는다. 정확한 파일 목록은 w4 패킷 기준이며 본 패킷에는 없다.
- 이번 변경에서 불변인 항목: `NORMAL_SCORE_MEAN=50`, `NORMAL_SCORE_SD=10`, 순위·finite·invalid 규칙, 모집단 정의.

## 검증 (w3, 로컬)
- `node --import tsx --test tests/insights-score-normal.test.ts`: 8/8 통과.
- `node --import tsx --test tests/insights-role-score-calibration.test.ts`: 5/5 통과. 리뷰 당시 4개였으나 외부에서 5개로 바뀌었다(소유 밖).
- `tsc -p tsconfig.json --noEmit`: 1건 실패, 소유 밖. `tests/insights-role-score-calibration.test.ts(76,42)`의 `PlanCatalogEntry` 타입 불일치다. 소유 파일 오류는 0건이다.
- 줄 수: 네 파일 모두 100줄 이하(모듈 44, 테스트 69, 리뷰 53, 후속 40). 공백 오류 0건. 소유 파일은 모두 untracked라 `git diff --check` 대신 grep으로 확인했다.
- `python3 scripts/validate-repo.py`: PASS, 672개 파일·7개 스킬, 위반 0건.

## 미결·후속
- 테스트 6행 주석 `~1e-6`은 중심 기준이다. 꼬리(p<1e-6) 오차는 주석에 없으므로 필요 시 정리한다.
- 소유 밖 typecheck 실패(calibration 테스트)는 해당 소유자가 정리한다. 본 작업에서 수정하지 않았다.
