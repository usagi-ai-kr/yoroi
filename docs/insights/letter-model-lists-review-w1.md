# letter-model-lists 구현 리뷰 (w1, `yoroi-lists-review-w1`, 2026-10-16)

- 대상: w3 구현 — `config/letter-model-lists.json`(5줄)·`src/insights/letter-model-lists.ts`(66줄)·filter/candidates/unified 연동 diff. `letter-top10-rank.ts` +2줄(o 비준)은 이슈 아님.
- 검증: 계약 테스트 **6/6 PASS** · 전체 unit **1074/1074** · typecheck PASS · validate PASS(763 files·8 skills) · 파일 전부 ≤100줄(filter/candidates/unified 각 100).

## 차단 이슈
- **없음.**

## 완료 기준 대조
- 빈 ban + 기본 allowOlder → 기존 Top10 완전 동일(deepEqual) + 전체 회귀 PASS.
- allowOlder: grok-4-6·gpt-6-sol 유지 / 미등재 하위버전 배제 / 목록 제거 시 배제(기본·`[]`·부분 목록 3케이스) PASS. `olderGenerationModelIds`의 allow delete 이중 보호 확인.
- ban: `buildList` **선발 필터에만** 합류(점수·모집단 `scored`/`cal` 불변) — 표시 점수 불변·반대 역할 무영향·▽ 재진입 없음 PASS.
- `banSetFor` 정규화(`listKeyOf`=normalize+정적 별칭) ✓ · 로더(ENOENT 기본값·키별 기본값·파싱 throw) ✓ · `excludePatterns` 의미 보존 ✓ · config 기본값 = 현 하드코딩과 동일 ✓.

## 비차단 관찰 (조정 권고)
1. `isProtectedPair`(후속 규칙 보호)가 "한쪽이라도 화이트리스트"면 보호 — 계약은 '**목록의 모델**이 superseded되지 않음'이므로, 목록 모델이 successor 쪽일 때 비목록 predecessor가 후속 규칙을 면제받는 교차-family 엣지 존재(일반 쌍은 세대 비교가 커버). 권고: predecessor 기준으로 좁히기.
2. `activeLetterModelLists()`가 파싱 오류를 삼키고 기본값으로 진행(운영 안전) — 경고 1줄 로그 권고.
3. ban 누락 하위 키를 `[]` 고정(기본값 복사 아님) — 기본값이 빈 배열인 동안 동등, 기본값 변경 대비 주석 권고.

## 결론
- 차단 없음 — **머지 가능**(비차단 3건은 선택 수정). 소스 수정하지 않음(리뷰 전용), 커밋 없음.
