# yoroi 1.0.2 릴리스 노트 준비

- 상태: PR #166용 본문과 Release 노트를 준비했다. GitHub Release, tag, 레터는 발행하지 않았다.
- 제목: `yoroi 1.0.2`.
- 문제·변경: 오케스트레이터 가성비(70/5/10/15) 복구. AA `log10(I/(P+0.01))` 정방향과 Cognition USD/task 역방향을 소스별 정규화한 뒤 가성비 차원 최대값을 사용한다.
- 표시 점수: 오케스트레이터 38개·워커 19개 전체 적격 대표 모집단의 midrank → Φ⁻¹ → 50+10z를 표시 점수에만 적용한다(평균 50, SD 약 10).
- 보존: raw 가중합, worker bonus, raw 순위, 대표 effort, 자격, ▽ 및 invalid `-` 표시는 유지한다.
- 정책: 기본 출력 예산 3600자와 Free 3500자 fallback은 변경하지 않는다.
- 이월·미발행: 워커 p85·cpt/total·effort fallback은 1.1로 이월한다. #160/#162 레터는 수정·재발행하지 않으며 #163/#164는 등록 기록만 유지한다. 신규 milestone·Closes 지시는 없다.
- 검증 근거: 기존 clean snapshot 기록은 단위 1041 / BDD 45 / 632 / build PASS (`yoroi 1.0.2`)다. 다른 상태 문서에는 1042도 기록되어 있어 이 수치를 최종 CI 결과로 해석하지 않는다.
- 최종 PR CI와 merge SHA는 이 문서에서 확정하지 않는다. 향후 tag는 main CI 성공 후 병합 SHA를 대상으로 한다.
- 준비 산출물: `/tmp/yoroi-102-release-notes.md`, `/tmp/yoroi-166-final-pr-body.md`.
