# 1.0.3 워커 effort 라벨 최소 수정 후보 (w1, `yoroi-103-effort-fix-candidate-w1`, 2026-10-16)

- 배경: DeepSeek 조사(`deepseek-effort-selection-explanation.md`) — AA는 Max만 측정, Cognition은 high만. 워커 라벨 `high`(Cog)·표시 지수 39.5(AA Max)의 소스 불일치.
- 범위: **label 정합만** — weights·worker bonus·Cog 가산·p85·price·R·normal·오게 대표 선정 불변. 모델별 hard cap/강제 경로 없음. high capability cap 근거 없음.

## 후보

- base: v1.0.2 main/tag `adea4d33868b6b40219fdf4da06de1e0e637a2d2` clean archive → `/tmp/yoroi-103-final-clean`, manifest `/tmp/yoroi-103-final-manifest.json`, builder `/tmp/yoroi-103-build-clean.py`.
- **최소 수정**: `src/insights/letter-top10-score.ts` 워커 분기 — chosen effort가 `aaEffort`에 없고 AA에 다른 effort 값이 있으면 표시 effort를 그 **AA 값의 effort**(`best(aaEffort)`)로 맞춘다. chosen이 AA에 있으면 그대로, `aaEffort` 전무면 기존 동작(chosen 유지) — p85 하한·no-AA 정책 보존. 파일 100줄 유지.
- **신규 좁은 회귀**: `tests/insights-worker-effort-label.test.ts` — ① AA에 chosen 존재 → 라벨 유지 ② AA에 chosen 없음 → AA fallback effort 라벨·값 일치(DeepSeek 케이스) ③ AA 전무 → 기존 워커 정책(intel 하한) 보존. 기존 `tests/insights-worker-effort-source.test.ts`(원본 dirty)는 보존·후보 미포함.
- **버전**: package.json 1.0.3(ROOT·후보 동일, 직접 요청 patch). docs: release-status·tasks에 1.0.2 발행·1.0.3 준비 반영.
- **제외**: dirty5 중 score의 최소 fallback 외(`four-source-score.md`·`orchestration.md`·takeover·`worker-effort-source.test.ts`)와 진척 문서는 후보 미포함·원본 보존.

## 검증 (후보, 2026-10-16, 실제 실행)

- typecheck·build·validate **PASS**(713 files) · unit **1063/1063**(기존 1060 + 신규 p103 3) · BDD **45 시나리오/632 스텝**.
- **renderer 1.0.2 vs 1.0.3 실측 diff = 정확히 1줄**: 워커 4위 `deepseek-v4-1-flash` 추천 effort `high`→`max`뿐 — 스코어 59.3·구성 63/100/51/47·가산 +4.4·AA 39.5·단가·순위·변동·요약·다른 행 전부 동일. **raw 값·점수·순위·대표 선정 불변** 확인(영향 0).
- 렌더 조건: 후보에 ROOT `.env`를 **값 미출력**으로 일시 복사해 1회 렌더 후 즉시 삭제(후보 오염 없음, 저장 스냅샷 2026-10-16 기반). 신규 테스트는 `tests/insights-worker-effort-label.test.ts` 3케이스.

## 조건

- **원값·점수·순위·대표 선정 영향 발견 시 즉시 보고 후 대기**. commitpush/PR/merge/Release/global/letter 이번 단계 없음. 원본 ROOT dirty 보존(score 원본 포함).

## 후속

- w3 독립 리뷰 → commit/PR 흐름으로 인계. 보고 후 대기.
