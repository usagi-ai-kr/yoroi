# Issue #195 Unit 2: 3개 역할 선발 어댑터 (Top7/Top15 슬라이스)

## 1. 개요
이 문서는 Issue #195의 **Unit 2: 3개 역할 선발 어댑터** 명세다. Unit 1에서 커밋된 `letter-role-selection.ts` 순수 선발 알고리즘을 재사용하며, 상위 계층(레터 렌더러·카탈로그·CLI 등)과의 통합 전 독립 어댑터로 동작한다.

> [!IMPORTANT]
> **기존 발행 출력 불변**: 본 단위는 독립 어댑터와 테스트만 작성하며, 기존 레터 렌더링·카탈로그·CLI·발행 출력은 일체 변경하지 않는다.

## 2. 인터페이스 (`src/insights/letter-three-role.ts`)
- `WeightClassifier<T>`: `(modelId: string, candidate: T) => boolean | undefined`
- `ThreeRoleAdapterInput<T>`: `orchestrator?`, `reviewer?`, `worker?`, `classifier?`, `depth?` (기본값 15).
- `RoleSlices<T>`: `top7`, `top15`, `all`.
- `ThreeRoleSelectionOutput<T>`:
  - 역할별 슬라이스: `orchestrator`, `reviewer`, `worker` (각각 `top7`, `top15`, `all` 제공)
  - 편의 그룹화: `top7`, `top15` (역할별 목록 제공)
  - `unconfirmedModels`: 오픈/클로즈드 미확인으로 보수적 배제된 모델 식별자 목록

## 3. 핵심 계약 및 정책
1. **리뷰어 채점 정책 미조작 (Do not invent reviewer weights)**
   - 본 어댑터는 리뷰어 점수 가중치를 임의 산출하거나 변경하지 않는다.
   - 호출자로부터 사전 정렬된(pre-ranked) 리뷰어 후보 목록을 그대로 주입받아 선발에 사용한다.
   - 독립 리뷰어 점수/가중치 정책 확정은 사용자의 명시적 결정 사항으로 유지된다.
2. **오케·리뷰 교대 MECE 및 워커 독립**
   - Unit 1 규칙을 그대로 적용: o1 → r1 → o2 → r2 ... 순서로 선발.
   - 클로즈드 웨이트 모델은 오케·리뷰 간 상호 배타(MECE).
   - 오픈 웨이트 모델은 오케·리뷰 간 중복 선발 허용.
   - 워커 선발은 오케·리뷰와 완전 독립적으로 자체 순위를 유지.
3. **미확인 분류의 보수적 처리**
   - 후보 자체 또는 주입된 `classifier`에서 분류가 누락/미확인인 경우 보수적으로 클로즈드로 취급하고 `unconfirmedModels`에 수집.
4. **Top7 / Top15 슬라이스 노출**
   - 본문용 Top7, 댓글용 Top15, 전체 선발 목록을 역할별로 분리 노출.

## 4. 검증 결과 (`tests/insights-letter-three-role.test.ts`)
합성 픽스처 기반 9개 단위 테스트 통과:
1. `alternating order o1, r1, o2, r2 and top7/top15 slices`
2. `closed duplicate exclusion across o/r`
3. `open-weight duplicate allowed across o/r`
4. `worker independence`
5. `empty/short lists handling`
6. `unknown classification treated conservatively as closed + unconfirmed`
7. `classifier function injection`
8. `distinct generations/variants not merged`
9. `deterministic repeat`
