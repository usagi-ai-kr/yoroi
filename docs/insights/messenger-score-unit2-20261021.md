# 메신저 점수 U2 (2026-10-21)

## 범위
- 단일 역할 경로 `computeRoleList(records,'messenger',opts)` 추가.
  워커와 같은 후보 풀·cap·대표 effort·속도·가격·가산·intel 하한.
  가중치 .20/.10/.30/.40, 임계 .60, 결측 .99만 다르게 쓴다.
- `role === 'worker'` 분기를 `isWorkerLike`로 묶음:
  score.ts(수집·표준화·가격·가산·하한·uplift·컷),
  worker-price cap, model-lists 밴, worker 레거시 경로.
- 오케·워커 출력 불변 (기존 스위트 녹색, 단일 워커≒Top10 워커).

## 실측 고정
- 속도 우위: 워커 [m-slow 70, m-fast 50] → 메신저 [m-fast 70, m-slow 60].
- 결측 89.60(missing .99), 하한 33, cap 초과 below-zone,
  동점 모델명순, 미확인 제외, 메신저 밴=워커 밴.

## 보류 (U3로)
- 전역 `OptimalZoneRole` 확장은 미적용.
  이유: `letter-markdown-format.ts` 등 언소유 `Record<OptimalZoneRole>`
  리터럴이 깨지고, 렌더러 수정은 본 패킷 금지다.
- 소유 모듈은 `RoleWithMessenger`로 처리하고 언소유 호출엔
  worker 매핑(srcRole)으로 전달한다. 제품 출력은 기존과 동일.
- U3 소유에 렌더러·`RoleLists`·`SECTION_HEADINGS`를 포함해
  원자적으로 확장해야 한다.
- `tests/insights-top10-score.test.ts`를 신규 생성해 메신저 회귀를
  분리했다 (c-policy·score-weights는 기존 범위 유지).
- `letter-top10-unified.ts`가 116줄로 100줄 제한을 초과한다.
  computeRoleList 16줄이 원인이며, 소유 내 압축·분리가 불가해
  U3(메신저 전용 모듈, 적정 소유 지정) 또는 제한 예외 기록이 필요하다.

## 검증 (U2b)
- typecheck·diff-check 통과. focused 31/31 (동기화 2종 포함).
- 전체 `pnpm run check`: 아래 보고서에 exit/counts (2 failures 해소 목표).
- 2 실패 동기화: 언소유→U2b 소유 지정으로 테스트 전용 1줄씩 반영.
- `validate-repo.py`: PASS (993 files).
- 단일 경로는 `letter-top10-messenger.ts`(28줄)로 분리,
  `unified.ts` 100줄·`buildList` export 공유·순환 import 없음.
- 커밋·push·외부 쓰기 없음.
