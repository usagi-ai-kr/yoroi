# 메신저 점수 U1 (2026-10-21)

## 범위
- 가중치 등록만: messenger .20/.10/.30/.40 (권고값, 확정 아님).
  config·타입·기본값·합=1 검증 일관.
- `isWorkerLike` 공용 helper + 임계 0.60 (priceMissing .99·intel 33 공유).
- 파이프라인 배선·단일 역할 경로는 다음 단위 (U2).

## 불변
- 오케·워커 가중치·출력 불변 (기존 스위트 녹색).
- OptimalZoneRole 확장은 U2에서 타입 캐스케이드와 함께 수행.
  본 단위는 렌더러·publish·워크플로·기존 점수에 손대지 않았다.

## 다음 (U2)
- `role === 'worker'` 분기 묶음 + `computeRoleList(records,'messenger',opts).
- 속도·비용 우위·결측·cap·동점·미확인 회귀.
- tests/insights-c-policy.test.ts 1단언 동기화는 소유 예외로 보고됨.
