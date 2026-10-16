# Ollama Muse Spark Open 구현 기록 (#167, w3)

- gate: #167 OPEN 확인(`gh issue view 167`, 라벨·마일스톤 없음).
- 근거: `docs/insights/ollama-muse-official-metadata.md`(2026-10-16 직접 확인).
- 공식 접근 근거: library 본문 cloud 뱃지·`run :cloud`·API 예시·요금($1.25/$0.15/$4.25).
- pricing 페이지 미등재라 sourceUrl은 library URL. 근거 없는 verified 없음.

## 변경 (소유 파일만)

- `src/insights/plan-catalog.ts`: `ollama-cloud-pro`에 `muse-spark-open` 추가.
- verified true, checkedOn 2026-10-16. usageLimit·free·billing 없음(공식 표기 없음).
- `src/insights/model-aliases.ts`: `muse-spark-open:cloud` → `muse-spark-open`.
- 실측: normalize가 `:cloud` 유지·`ollama-cloud/` 제거. CLI 태그만 별칭 필요.
- 1.3(`muse-spark-1-3`, OpenCode Go Plus)과 교차 별칭 없음. 절대 합치지 않음.

## 후보·Top10 정책 보존

- 카탈로그 등록 ≠ Top10 자동 진입. 근거 행 없으면 풀에 안 생긴다.
- evidence 규칙(`top10-unmeasured-evidence.md`) 그대로. 점수·R·정규화 미변경.
- `model-id.ts`·config·README·AGENTS 미접촉. 기존 dirty 보존.

## 검증

- 신규 합성 테스트 4건 PASS (접근·`:cloud` 별칭·접두사·1.3 분리·Top10 미진입).
- typecheck PASS. validate PASS (700 files, 7 skills). 전체 build 없음.
- 기존 테스트 3건 실패 확인(비소유, 미수정 — 읽기만 실행):
- `insights-plan-catalog.test.ts` 개수(ollama 18→19)·checkedOn 허용 목록,
- `insights-model-aliases.test.ts` (B) checkedOn 허용 목록.
- 모두 카탈로그 변경 감지용 단언이라 소유자 갱신이 필요 → w2 독립 리뷰로 인계.
- commit/push/PR/merge/close/tag/Release/global/pull/serve/레터 발행 없음.
- 보고 후 대기. 독립 리뷰 w2 예약.
