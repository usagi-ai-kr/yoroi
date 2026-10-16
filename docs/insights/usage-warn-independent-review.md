# #164 warn 구현 독립 리뷰 (w3, yoroi-164-independent-review-w3)

- 대상: w2 보고서 `/tmp/yoroi-164-warn-implementation-w2-report.json` + 실제 diff 대조.
- 기준: `usage-warn-implementation-plan.md` §4 9항목, #164 본문, dispatch 13:10 확정 지시.
- 방법: 자기보고 신뢰 없이 코드·테스트 직접 실행. 읽기만 수행, 수정 없음.

## 9항목 대조 (실측)

1. 우선순위 `limit(≥98) > warn(≥90,<98) > exp > n/a`: `pace.ts:24-27` 그대로. PASS.
2. 전 창 동일 90%: 분기 전 창 공통, weekly/monthly/five-hour 합성 확인. PASS.
3. exp 없어도 warn: 무exp 90·97.9 → warn 테스트. PASS.
4. 행별 독립: 다중 window warn/n/a/limit 각각 유지. PASS.
5. `percent > used/limit`, remaining 추가 없음: `actualPercent` 무변경.
- remaining-only 창 → n/a 독립 실측 확인(유·무exp 모두). 명시 테스트 없음(아래).
6. 원본값 비교: raw 89.991 → optimal, 표시 90이어도 warn 아님. PASS.
7. `pc.yellowBright`(93) + 기본 `SHOWN_STATUSES` 포함: escape `\u001b[93m` 단언,
- over yellow(33)와 다름 단언, 기본·full 노출 단언. PASS.
8. `usage_status=warn`: plain key=value 4공급자 단언. PASS.
- JSON은 전 상태 공통으로 status 문자열 없음(raw 스냅샷) — 회귀 아님, 표현만 부정확.
9. 경계 7값(89.9/90/97.9/98/99.9/100/unknown): 매트릭스 전수. PASS.

## 테스트 count 실측

- 지정 7파일: **38 tests pass, 0 fail** (w2 보고 38 정확).
- 메신저 48과의 차이: 실측 38이 정확. 48의 산출 근거 미확인.
- 기존 기대값 변경은 pace(9/10→warn, over는 8/10 유지)·95%→warn 2건으로 정당.

## 경미 결함 2건 (차단 아님, 오케 전달)

- remaining-only 명시 테스트 부재: 동작은 실측 n/a. 1단언 추가 권장(소유자 후속).
- 8번 "JSON" 표현: plain만 해당. 진행 문서 문구 정정 권장. 회귀 없음.

## 완료 판단

- 코드 준비 완료. 단 #164는 OPEN 유지 — close는 직접 하지 않음.
- 미커밋 상태(`M` 6파일 + 신규 2파일)와 완료 판단을 분리: 병합·close는 사용자/오케 결정.
- typecheck PASS, validate PASS (705 files). 전 파일 100줄 이하.
- commit/push/PR/merge/close/tag/Release/global/레터 없음. 보고 후 대기.
