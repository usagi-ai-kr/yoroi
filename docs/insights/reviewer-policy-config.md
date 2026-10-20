# #195 리뷰어 정책 설정 외재화 및 가중치 확정 (2026-10-20)

## 1. 개요
사용자 확정 가중치(성능 50% / 속도 20% / 가격 30%)를 코드에 하드코딩하지 않고 `config/reviewer-policy.json`을 단일 원본(source of truth)으로 외재화했다.
운영자가 JSON 설정을 수정하면 코드 변경 없이 즉시 반영된다.

## 2. 설정 계약 및 로더 (`src/config/reviewer-policy.ts`)
- **설정 파일**: `config/reviewer-policy.json`
  ```json
  {
    "weights": {
      "performance": 0.50,
      "speed": 0.20,
      "price": 0.30
    }
  }
  ```
- **상태 전이**: 잠정(provisional)에서 확정(`status: 'confirmed'`, `confirmed: true`)으로 승격.
- **검증 규칙 (fail-fast)**:
  - 3대 차원(`performance`, `speed`, `price`) 필수.
  - 음수, 비유한수, all 0, 합계 불일치(`sum !== 1.0`), 모르는 차원은 즉시 예외로 거부.

## 3. 점수 산출 우선순위 계약 (후보 score 우선 버그 해소)
- **문제 해결**: 후보에 이전(오케 등) 점수가 있더라도, 3대 차원 근거 데이터(`performance`, `speed`, `price`)가 유효하면 **리뷰어 가중치 산식을 우선 적용**하여 점수를 재계산한다.
- 이를 통해 설정 파일의 가중치 변경이 리뷰어 순위 정렬에 온전히 반영된다.
- 근거 데이터가 결측된 경우에만 기존 점수를 보존하며(날조 없음), 커스텀 `scoreCallback`은 최우선 적용된다.

## 4. 검증 결과
- `tests/insights-reviewer-config.test.ts` (6건): JSON 기본값 로드, 확정 상태, 유효성 검증 실패(음수, NaN, 합계 불일치, 모르는 키), 파일 override.
- `tests/insights-reviewer-policy.test.ts` (6건): 확정 가중치 적용, 가중치 override 순위 변경, 점수 우선순위 버그 수정 실측, 오케·워커 불변.
- 모든 파일 100줄 이하 준수.
