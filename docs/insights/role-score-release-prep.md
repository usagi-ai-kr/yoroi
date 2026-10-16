# 정규 순위 보정 릴리스 준비 (1.0.2)

- 확정 범위: R 가성비 4차원 복구 + 역할별 전체 적격 대표 모집단 normal midrank→Φ⁻¹→50+10z 표시 보정.
- raw 가중합·worker bonus·대표 effort·Grok 자격·▽ 원정책 유지. 표시 점수만 50중심·SD 약10.
- 릴리스 문서 갱신: release-status·tasks·PR body. 이전 "worker 점수 완전 불변" → **raw 불변/표시 보정**으로 명확화.
- 검증 구분: R 단계 clean 1027 PASS / 표시 보정 통합 검증 진행(clean 신규 구성으로 validate 672·calibration/score-normal/dimension-contract 24/24).
- 이슈 #163 ban·#164 warn은 등록만. #160/#162 레터 미수정·미재발행. 새 milestone 없음.
- **clean 구성**: builder `/tmp/yoroi-normal-build-clean.py` → `/tmp/yoroi-normal-clean`(origin/main `698898767` + 75 allowlist, worker hunk 제거), manifest `/tmp/yoroi-normal-clean-manifest.json`. full check PASS(1041/45·632/build·1.0.2).
- staging: 기존 stale `/tmp/yoroi-r-stage-index` **사용 금지** — clean 기준 새 staging 후속.
- 비소유(담당 fix 중): w1 `insights-role-score-calibration.test.ts` TS2322(현재 repo typecheck 재확인 필요), w4 NaN guard·w3 math.
