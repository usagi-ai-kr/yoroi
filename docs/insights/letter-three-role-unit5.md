# #195 단위5 — 레터 합성에 3역할 기본 꺼짐 연결 (2026-10-20)

- 범위: 3역할 파이프라인(단위4)을 `runInsights` 합성에 **선택 옵션**으로 연결. **단위5이며 #195 전체 완료를 뜻하지 않는다.**
- 소유: `src/composition/insights.ts`·`src/insights/letter-three-role-pipeline.ts`·`tests/insights-composition.test.ts`·본 문서.
- **발행(publish)은 켜지 않았다.** 기본 레터 출력·스코어링·카탈로그는 그대로다(기본 꺼짐).

## 1. 계약

- `InsightsRunOptions.threeRole`: 생략 또는 `false`가 기본값.
- **기본 꺼짐(Default-Off)**: 생략 또는 `false`인 경우 반환 객체에 `threeRole` 키 자체가 없으며 기존 실행 결과와 **100% 동일(deepEqual 실측)**.
- **활성화 시(Flag-On)**: `threeRole: true` 또는 옵션 객체 전달 시 `runThreeRolePipeline`을 실행하여 `out.threeRole`에 3역할 선발(`selection`), 마크다운(`markdown`), 섹션 맵(`sections`)을 덧붙인다.
- 오케·워커·리뷰어 후보가 미지정된 경우 수집된 `top10.records` 기반으로 자동 구성하되 기존 소스 가중치는 변경하지 않는다.
- 리뷰어 가중치는 단위4에서 격리된 잠정치(50/20/30) 외에 임의 변경하지 않는다.

## 2. 검증 (합성, 네트워크 0)

`tests/insights-composition.test.ts` 2건 추가:
1. `default-off`: `threeRole` 생략/false 시 기존 baseline 실행 결과와 완전히 일치(deepEqual).
2. `flag-on`: 3개 역할 섹션(오케스트레이터·리뷰어·워커 Top7) 렌더링 및 `sections`/`selection` 형태 확인.

### 2-1. 본 단위 실측 검증 (2026-10-20)

- `pnpm run check` exit 0: typecheck ok · unit/integration **1289/1289** 통과(실패 0·flaky 0) · BDD **45 시나리오 / 635 스텝** 통과 · build ok.
- `python3 scripts/validate-repo.py` PASS(910 files, 8 skills, 줄 수·규칙 위반 0건) · `git diff --check` clean.
- 독립 리뷰 4건 PASS: 역할선택(Unit 1) · 3역할 렌더러(Unit 3) · 리뷰어 정책 파이프라인(Unit 4) · 본 단위 배선 리뷰(Unit 5).

### 2-2. 설계 계약 3가지 (리뷰 확인 사항)

1. **default 경로의 잠정 가중치 미적용**: 후보 미지정 시 `top10.records`를 쓰는데, 이 후보는 명시 `score`를 갖고 있어
   `computeReviewerScore`가 그 값을 우선한다 → 리뷰어 잠정 가중치(성능 50·속도 20·가격 30)는 **기본 경로에서 적용되지 않는다**(리뷰어 목록에만 격리 적용).
2. **오케스트레이터·워커 중복은 설계 계약**: 배제 규칙은 오케스트레이터↔리뷰어 사이에만 적용된다.
   워커는 독립 목록이므로 한 모델이 오케스트레이터와 워커에 함께 실리는 것은 계약 범위다.
3. **출력 경로는 하나만 소비**: 통합 시 전체 `markdown` 또는 `sections` 중 **한 경로만** 레터에 붙인다(둘 다 붙이면 같은 내용이 두 번 렌더된다).

## 3. 남은 범위

1. 3역할 리포트의 실제 파일럿/검토 후 발행 워크플로우 연동 — 미구현(기본 꺼짐 유지).
2. 사용자 리뷰어 가중치(50/20/30) 공식 확정 — 미결정(잠정 유지).
3. 출력 경로 1개만 쓰는 통합 규칙 — 미구현(위 2-2-3).
