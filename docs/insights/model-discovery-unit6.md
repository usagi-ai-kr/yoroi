# #168 모델 자동감지 오케스트레이션 러너 (Unit 6, 2026-10-20)

## 1. 개요
Issue #168 (신규 모델·플랜 가용성 자동감지)의 **Unit 6: 기본 비활성(Default-Off) 탐지 러너** 구현 명세다. 이전 단위에서 개발된 스냅샷(`unit2·3`), 어댑터(`unit5`), 설정 타입(`model-discovery-config.ts`)을 비침습적으로 결합한다.

> [!IMPORTANT]
> **기존 설정·카탈로그 불변**: 본 러너는 `enabled: false`가 기본값이며, 기존 설정 파일(`letter-model-lists.json`), 카탈로그(`plan-catalog.ts`), daily `once` 사이클, 레터 렌더러는 일체 수정하지 않는다. Q1~Q4 정책(자동 편입, 폐지 유예, 저장 경로, 외부 키)은 임의 결정되지 않는다.

## 2. 설정 계약 (`src/insights/model-discovery-config.ts`)
- `ModelDiscoveryConfig`: `enabled` (기본값 false), `providers?`, `baseDir?`, `excluded?`.
- `loadModelDiscoveryConfig(raw)`:
  - 설정이 누락되거나 형식이 다를 경우 항상 `{ enabled: false }` 반환.
  - `enabled: true`가 명시된 경우에만 활성화.
  - `excluded`는 정규화 ID 기준으로 필터링 (fail-closed).

## 3. 러너 파이프라인 (`src/insights/model-discovery-runner.ts`)
`runModelDiscovery(opts)` 실행 절차:
1. **비활성 단락**: `config.enabled !== true`인 경우 스냅샷 저장소 조회나 어댑터 호출 없이 즉시 no-op 요약 반환.
2. **어댑터 순회 및 제공자 격리**:
   - `config.providers` 지정 시 해당 제공자만 선별 실행.
   - 각 어댑터별로 저장소에서 이전 스냅샷(`previous`) 독립 조회.
3. **수집 및 적격성 검증 (checkEligibility)**:
   - `adapter.discover(ctx)` 호출 후 `config.excluded` 항목 배제.
   - 5대 메타데이터 요건 미충족 및 미확인(`verified !== true`) 항목은 `checkEligibility`에 의해 후보 탈락.
4. **Diff 계산 및 스냅샷 갱신**:
   - 이전 스냅샷과 적격 모델 간 `diffRegistry` 수행.
   - `resolveCollection`을 거쳐 유효하고 세대가 전진된 스냅샷만 `store.write` 수행.
5. **실패 시 Last-Good 보존**:
   - 어댑터 수집 실패(예외) 시 저장소를 덮어쓰지 않고 기존 유효 스냅샷을 그대로 유지하며, `errors` 카운터 증가.

## 4. 검증 결과 (`tests/insights-model-discovery-runner.test.ts`)
합성 픽스처 기반 7개 단위 테스트 통과 (네트워크 호출 0건):
1. `disabled config is a no-op and does not touch store`
2. `successful provider writes a snapshot to store`
3. `failed collection preserves last-good snapshot`
4. `unverified and invalid rows are rejected from snapshot`
5. `diff summary calculates added, removed, changed`
6. `provider isolation across multiple adapters`
7. `config.providers filters adapters`

> [!NOTE]
> 본 단위는 독립 러너 및 설정 파서 구현(Unit 6)이며, 사용자 Q1~Q4 정책 승인 및 once 파이프라인 실제 연동 전까지 #168 전체 완료를 의미하지 않는다.
