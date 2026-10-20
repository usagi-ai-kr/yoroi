# Issue #195 Unit 4: 리뷰어 잠정 정책 및 기본 꺼짐 3역할 파이프라인

## 1. 개요
이 문서는 Issue #195 (오케·리뷰 교대 MECE 선발 + 워커 독립)의 **Unit 4: 리뷰어 잠정 정책 및 기본 꺼짐 파이프라인** 명세다.
Unit 1(교대 선발), Unit 2(3역할 슬라이스), Unit 3(독립 렌더러)를 통합하며 기존 레터 출력·CLI·발행(publish)은 일체 변경하지 않는다.

## 2. 리뷰어 정책 (`src/insights/letter-reviewer-policy.ts`)
- **잠정 가중치(Provisional)**: `performance: 0.50`, `speed: 0.20`, `price: 0.30`.
- **잠정/미확정 명시**: `REVIEWER_POLICY_STATUS = 'provisional'`, `REVIEWER_POLICY_CONFIRMED = false`. 사용자 승인 전까지 비공식 잠정치다.
- **역할 격리**: 오케스트레이터 및 워커 후보에는 본 정책을 절대 적용하지 않는다.
- **점수 산출 계약**:
  - 사전 부여된 `score`가 있으면 우선 보존.
  - 커스텀 `scoreCallback` 주입 지원.
  - 결측 차원이 존재하면 점수를 임의 조작·날조하지 않고 `undefined` 유지 (렌더러에서 `-` 표기).

## 3. 3역할 파이프라인 (`src/insights/letter-three-role-pipeline.ts`)
- **기본 꺼짐(Default-Off)**: `options.enabled === true`가 아닐 경우 `{ enabled: false }` 즉시 반환 (기존 경로 무영향).
- **실행 절차**:
  1. 리뷰어 후보에만 잠정 정책(`applyReviewerPolicy`) 적용.
  2. 오케·워커 후보는 불변 상태로 통과.
  3. Unit 1+2 `selectThreeRoles` 교대 MECE 선발 실행.
  4. Unit 3 `renderThreeRoleMarkdown`을 통해 Markdown 리포트 생성.

## 4. 검증 결과 (`tests/insights-letter-three-role-pipeline.test.ts`)
합성 픽스처 기반 9개 단위 테스트 통과 (네트워크 호출 0건):
1. `default-off returns no output when enabled is false or omitted`
2. `reviewer weights applied only to reviewer; orchestrator & worker unchanged`
3. `accepts pre-scored candidates or custom score callback`
4. `missing evidence does not fabricate scores ("-" in table)`
5. `MECE closed duplicate exclusion across orchestrator and reviewer`
6. `MECE open-weight duplicate allowed across orchestrator and reviewer`
7. `worker independence from orchestrator and reviewer`
8. `renderer integration renders 3 role sections with depth and legend`
9. `deterministic repeat across multiple runs`
