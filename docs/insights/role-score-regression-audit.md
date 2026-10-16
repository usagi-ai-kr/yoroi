# 정규 점수 통합 회귀 감사 (읽기 전용)

- 범위: w1 정규 점수 통합이 working tree에 반영된 상태의 typecheck/unit 1회. **최종 PASS 선언 아님**.

## 결과
- typecheck: **1 error** — `tests/insights-role-score-calibration.test.ts(28,22)` TS2532(Object possibly 'undefined'). (w1 신규 테스트)
- unit: **1041 중 1015 pass / 26 fail**.

## 실패 분류 (26건) — 전부 **표시 보정 새 기대값**
- 원인: `scoreText`가 이제 `normalRankScores(모집단)` 표시값이다(raw는 불변).
- 예: 2-모델 모집단 → 56.7/43.3 (=50±10·Φ⁻¹(0.25/0.75)). 실제 raw 계약(순위·▽·components·effort)은 유지.
- 대표 사례: `insights-dimension-contract`(25 중 다수)·`top10-source-policy`·`orchestrator-effort`·`c-policy`·`top10-fill`·`top10-unified`·`top10-unmeasured`·`top10-rank`·`orchestrator-value`·`free-global-top10`·`free-section`.

## 구분 (요구 분류)
- **코드 불변 R raw 계약 실패**: 없음. 검증기(`/tmp/yoroi-calibrated-letter-verify.mjs`)에서 raw==#160 20행·prodRawTop==popTop true.
- **표시 보정 새 기대값**: 26건 전부. 기대값을 normal 정책 근거로 갱신 필요(완화·삭제 아님).
- **compact 예산**: 이번 실패에 없음.
- **파일 101줄 제약**: `src/insights/letter-top10-unified.ts` 101줄 → validate FAIL(비소유, 담당 fix 중).

## 후속 소유 제안
- 표시 기대값 갱신: 기존 소유(regression 담당) — 각 테스트에 정규 정책 근거 주석.
- typecheck TS2532: w1 통합 테스트 소유.
- unified 101줄: w1 담당.
- BDD/build·최종 validate: 통합 완료 후 후속 단계.
