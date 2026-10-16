# 정규 표시 보정 회귀 정정 (1.0.2)

- 소유 11개 테스트에서 표시 `scoreText` 기대값을 raw 계약과 분리했다.
- raw 반영 assert는 `rawScore`(신규 필드)로 검증 → 가성비·source·가중·bonus·순위·▽ 강도 보존(완화·삭제 없음).
- 표시 전용 assert는 정규 분위 기대값 사용: `insights-orchestrator-value`에 n=1→50·n=2→56.7/43.3, `insights-top10-source-policy`·`insights-free-section` 렌더 표시값.
- w1 소유 신규 calibration 테스트·제품 101줄은 미수정. 원계산·워커 가중·가산·순위·Grok 자격·▽·메트릭 무변경.
- typecheck 기존 TS2532(`insights-role-score-calibration.test.ts`)는 비소유로 보고만.
