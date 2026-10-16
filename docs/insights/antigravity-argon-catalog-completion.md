# Argon 카탈로그 완성 (w1, #165, 2026-10-16)

- 대상: `gemini-4-argon` (`Gemini 4 Argon`) Antigravity 카탈로그 항목 — 메신저 추가분(ID·표시명) 보존 + 근거·가용성·카운트 보완.
- 근거(읽기 전용): `/tmp/shots/agy-dom.html`(메신저 공식 렌더 캡처) = https://antigravity.google/docs/models + `antigravity-argon-candidate-path.md` + handoff-followup-20261016. 외부 재조회 없음(중복 호출 금지).
- 소유: `src/insights/plan-catalog.ts` · `tests/insights-plan-catalog.test.ts` · `tests/insights-antigravity-argon.test.ts` · 본 문서. 다른 dirty 보존, catalog 외 source 무변경.

## 공식 근거 (agy-dom.html 직접 확인, 14:13 캡처)

- 가용성 표 헤더 순서: 모델 | 무료 및 Google AI Plus | Google AI Pro | Google AI Ultra | 엔터프라이즈.
- Argon 행(원문 마크): 무료·Plus ❌ · Pro ✅(각주 ** = 체험판 제외 정식 구독만) · Ultra ✅ · Enterprise ✅.
  - 각주 ***: Antigravity IDE에서는 불가 — App·CLI·IDE 확장에서 사용.
- 배너: "Google Antigravity에서 Google AI Pro 및 Ultra용 Gemini 4 Argon 사용 가능"(`/blog/gemini-4-argon-in-google-antigravity`).
- 무료·Plus 오해 금지: 항목 `note`에 무료·Plus 불가, Pro(정식 구독)·Ultra·Enterprise 전용, IDE 제외를 기록.

## 결정 1: 표현 — PlanModelEntry.note 선택 필드 추가, usageLimit은 비움

- 메신저 요구는 "usageLimit.note등 현 스키마"였으나 `usageLimit`은 count/period가 필수이고 값이 렌더에 붙는다. 공식 표에 수치가 없어 값을 창작하게 되므로 금지 — `tests/insights-cursor-plan.test.ts:16`의 "가격 페이지에 count 없음 → usageLimit 미기재" 선례와 동일 처리.
- 대신 `PlanModelEntry`에 `note?: string`(선택, 비파괴)를 추가해 Argon 항목에만 기록. 기존 소비자(`plansForModel`·`plansForCatalogModel`)는 무시 — 구조 보존.
- Argon만 checkedOn 2026-10-16. 기존 항목 날짜 일괄 변경 없음(CHECKED_ON_DOCS 2026-10-13 유지), #167 `muse-spark-open` 2026-10-16 보존.

## 결정 2: 카운트 정정 — ollama 19 / antigravity 10, 중복 0

- `ollama-cloud-pro` 19 = 기존 18 + `muse-spark-open`(#167, w3 구현). `antigravity` 10 = 기존 9 + `gemini-4-argon`(#165 메신저분).
- 추가 항목 ID·정규화 중복 검사 통과(normalize 중복 0). checkedOn 허용 목록에 2026-10-16 추가(소유 테스트).
- 기존 formatter(`m`·`mDocs`)를 단일 줄로 정리해 catalog 99줄 유지(≤100).

## AA 결측 후보경로 — candidates 수정 불필요 (조사 완료)

- `EVIDENCE_METRICS`(`top10-policy.ts:7`)가 이미 `total_tokens`·`opencode_data_tokens`를 포함 → 유지정책 그대로. candidates·score·policy 무수정.
- 신규 fixture 검증: OR 근거만으로 Argon이 오케 후보 유지(0점 placeholder `indexMissing`·▽ 보충), 워커는 AA intel ≥33 필수라 제외. OR 원값(123456) 유지 — AA 성능값 위조 없음.
- `antigravity-argon-candidate-path.md`의 공통 블로커(카탈로그 미등재)는 이번 단위로 해소(공개 근거 기준, 실 DB 재검증 아님).

## 검증

- 신규 `tests/insights-antigravity-argon.test.ts` 3/3 + `tests/insights-plan-catalog.test.ts` 7/7 → 10/10 PASS.
- plan-catalog 관련 24개 테스트 파일 116/116 PASS. `pnpm run typecheck` PASS.
- `python3 scripts/validate-repo.py` PASS(위반 0, 파일 수는 동시 작업으로 변동).
- 커밋·push·PR·merge·close·tag/Release/global/레터 없음. 라벨 `g-w-a` 완료 로직 무변경(`labels.ts` 미접촉).

## 후속

- 보고 후 메신저 지시 대기, 자동 후속 없음.
