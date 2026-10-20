# w3 모델 탐색 핵심 독립 리뷰 (2026-10-20) — 최종 READY

대상 5 src + 2 test + 1 doc. 초기 BLOCK 2건은 w3 수정으로 해소 확인.
추가 발견(무효 previous 세대 승계)은 본 리뷰에서 최소 수정+회귀검증.
실측 exit: 집중 23/23(0) · typecheck 0 · validate 0. 전체 check 중복 미실행.

## 확인됨

- 경계 정확: 30일 정확히 usable, +1ms expired, 미래·NaN·0세대 거부(재현).
- 중복 id fail-closed: eligibility 양쪽 거부(재현).
  정정: 앞선 “diff 인덱스 제외 확인”은 eligibility 범위였고 diff
  removed 오판은 덮지 못했다. 총괄 재현(`[m]→[m,m]` removed 오판)으로
  본 항목에서 수정한다.
- 순서만 다른 목록 무변경: build 정렬 + id 인덱스 비교(재현 0/0/0).
- provider 분리: 스냅샷 그룹별 대조, 혼입 없음(재현).
- 실패 시 last-good 보존: ok:false면 current 유지·changed:false(재현).
- 신뢰경계: verified 읽기·비교만, true 부여 없음. import는 insights
  내부만. fetch/spawn 없음. API/runtime 미연결 범위 유지.
- 렌더 1줄·제어문자 제거·64자 제한, 무변경 시 undefined.

## 중복 diff 보류 수정 (총괄 재현 반영)

- 재현: `diffRegistry(p,t,[m],[m,m])` → removed `[m.id]` (허위 폐지),
  역방향 → added `[m]` (허위 신규). 원인: 중복 id가 인덱스에서 빠져
  상대 목록에 없다고 판정됐다.
- 수정: `indexById`가 중복 id 집합도 돌려주고 diff는 양쪽 어느 한쪽이라도
  모호한 id를 added/removed/changed 모두에서 보류한다.
  eligibility 중복 거부는 그대로 둔다. 정상 id 변경은 보존한다(회귀 포함).
- 근거: 신규 회귀 1건(양방향+공존). 공개 API·런타임 연결 변경 없음.

## 차단 문제 1 — 잘못된 성공이 last-good을 버린다

- 위치: `src/insights/model-discovery-snapshot.ts:60-68`.
- 재현: `resolveCollection(cur, 'a', {ok:true, models, observedAt:'junk'}, now)`
  → `{reason:'invalid', changed:false}`이며 snapshot 키 자체가 없다.
  대입형 호출자는 last-good을 잃는다. 실패 회차는 current를 돌려주는데
  무효 회차는 안 돌려줘 비대칭이다. 테스트도 이 경우를 덮지 않는다.
- 최소 수정: 무효 build 시 `selectSnapshot(current, nowMs)` 결과를 snapshot에
  넣고 reason은 유지, changed:false 유지. 호출자·타입 변경 없음.

## 차단 문제 2 — 40일 전 성공 관측이 즉시 usable이다

- 위치: `model-discovery-snapshot.ts:46-56` (`buildSnapshot`).
- 재현: observedAt 40일 전으로 build → `{reason:'usable', generation:1}`.
  `selectSnapshot` 게이트를 거치지 않는 호출자는 만료 데이터를 usable로 쓴다.
- 최소 수정: 문제 1과 함께 — ok:true여도 `selectSnapshot`으로 재게이트하고
  만료면 reason `expired` + current 유지. 또는 build에서 만료 거부.
  어느 쪽이든 `resolveCollection` 반환 하나로 닫힌다.

## 비차단 메모

- eligibility는 provider 개념이 없어 목록 단위 호출자가 provider별 분리 책임.
  현 계약(단위2 범위)에선 문서 확인으로 충분.
- w3 보고의 arena TS2367 1건은 w1 수정분에서 해소됨(본 typecheck clean).

## 최종 판정 (2026-10-20, fix 재검토)

- 초기 BLOCK 2건(무효 성공 last-good 상실·40일 관측 usable)은 w3 수정
  (`lastGoodFor`·build 30일 게이트·provider 격리·nowMs 유한성)으로 해소 확인.
- 추가 차단(무효 previous 세대 -1·NaN·2.5·0 승계 → usable 무효 세대)은
  본 리뷰에서 2줄 최소 수정(정수 1 이상만 승계, 그 외 1세대) + 회귀 2건.
- 일반 스킬 외부사실 검증 1항(w2 작성) 읽기 전용 검토: 권한 확대 없음,
  URL·시점·일치 대조 요구가 Arena 교훈과 일치. 변경 없음.
- unit2 문서에 공식API 전부인증 같은 미검증 단정 없음 (§8은 미확인 표기).
  verdict: READY. 남은 범위는 저장소 구현체·어댑터·config·레터 연결(후속).
