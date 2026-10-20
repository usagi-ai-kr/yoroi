# Issue #195 Unit 1: 역할 교대 선발 코어 모듈

## 1. 개요
이 문서는 Issue #195 (오케·리뷰 교대 MECE 선발 + 워커 독립)의 **Unit 1 순수 모듈** 설계와 검증 명세를 정의한다. 기존 레터 렌더링·카탈로그·CLI·설정·발행 출력에 부작용을 주지 않는 독립 순수 함수로 구현되었다.

## 2. 인터페이스 (`src/insights/letter-role-selection.ts`)
- `RoleCandidate`: `modelId`, `baseModelId?`, `identityKey?`, `score?`, `weightOpen?`, `unconfirmed?`.
- `SelectedRoleCandidate<T>`: `rank`, `originalRank`, `identityKey`, `isClosed`, `unconfirmed`, `weightOpen`.
- `RoleSelectionInput<T>`: `orchestrator?`, `reviewer?`, `worker?`, `depth?` (기본값 15).
- `RoleSelectionResult<T>`: `orchestrator`, `reviewer`, `worker`, `depth`, `unconfirmedModels`.

## 3. 핵심 선발 규칙
1. **오케·리뷰 교대 라운드 로빈 (o1 → r1 → o2 → r2 ...)**
   - 각 라운드에서 해당 역할의 미선택 후보 중 자격 요건을 만족하는 최상위 후보 1명을 선발한다.
   - 요청된 `depth`에 도달하거나 자격 있는 후보가 소진될 때까지 교대한다.
2. **클로즈드 웨이트 상호 배타 (MECE)**
   - 클로즈드 웨이트 모델이 오케 또는 리뷰어 한쪽에 선발되면, 다른 쪽 역할의 선발 대상에서 즉시 배제된다.
3. **오픈 웨이트 중복 허용 예외**
   - `weightOpen === true`가 검증된 오픈 웨이트 모델은 오케와 리뷰어 모두에 동시 선발될 수 있다.
4. **워커 독립 선발**
   - 워커는 오케·리뷰어 선발과 완전히 독립적으로 자체 후보 순위에 따라 선발된다.
   - 오케·리뷰어 선발 모델이 워커에서 배제되지 않으며, 워커 선발도 오케·리뷰어에 영향을 주지 않는다.
5. **미확인 분류의 보수적 처리**
   - `weightOpen`이 미지정이거나 불분명한 경우 보수적으로 클로즈드(`isClosed: true`)로 취급한다.
   - 브랜드명 추정으로 임의 오픈 처리하지 않으며 `unconfirmed: true` 및 `unconfirmedModels`에 기록한다.
   - 역할 간 분류(open vs closed/unconfirmed) 상충 시 보수적 클로즈드 웨이트 MECE 우선 원칙이 적용된다.
6. **후보 부족 및 공백 처리**
   - 후보가 부족할 경우 부적격 후보를 강제 충원하지 않고 가용 후보만 반환한다.
   - 빈 모델명 등으로 정규화 식별키가 빈 문자열인 후보는 자동 건너뛴다.
   - 한 역할이 먼저 종료되어도 다른 역할은 계속 선발을 진행한다.
7. **세대·변형 식별자 보존**
   - `normalizeModelName` 및 `splitBaseAndEffort`를 사용하여 공급자 접두어 및 effort 접미사만 정규화한다.
   - 서로 다른 세대·변형(예: `gpt-4o` vs `gpt-4o-mini`, `sonnet` vs `haiku`)은 독립 식별자로 보존된다.

## 4. 검증 결과 (`tests/insights-letter-role-selection.test.ts`)
합성 픽스처 기반 9개 단위 테스트 통과:
1. `closed duplicate exclusion across o/r`
2. `open-weight duplicate allowed across o/r`
3. `worker independence from o/r`
4. `alternating round-robin order o1, r1, o2, r2`
5. `candidate shortage and empty list handling`
6. `unknown classification treated conservatively as closed + unconfirmed`
7. `distinct generations/variants not merged`
8. `deterministic repeat across runs`
9. `skip candidates with empty resolved identity key`

> [!NOTE]
> 본 모듈은 Issue #195의 Unit 1(코어 선발 알고리즘) 구현이며, 후속 Unit에서 렌더링 파이프라인 및 설정 연결이 진행된다.
