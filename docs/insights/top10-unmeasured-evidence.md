# AA 미측정 후보의 근거 유지 규칙 (unmeasured-evidence, 2026-10-13 사용자 지시)

## 사용자 요구 원문

- "aa 미측정의 경우에도 openrouter 스코어 / opencode data 자료가 있다면 그걸 고려하고 아예 제외하지 않기" — Discord 사용자 요구.

## 규칙 (src/insights/top10-policy.ts `EVIDENCE_METRICS`)

- 판정 기준 지표: OpenRouter `total_tokens`(최신 일 기준, aggregate·other 제외)와 OpenCode Data `opencode_data_tokens`(최신 comparisonDate).
- 둘 중 하나라도 있는 접근 가능 모델은 AA 미측정이어도 후보 풀에서 통째로 빼지 않는다(`buildCandidatePool`의 evidence 병합).
- 근거가 전혀 없는 AA 미측정 모델은 기존대로 후보가 되지 않는다("있다면 고려" 조건).
- 역할 지수 결측 변형은 기존 규칙대로 0점 `indexMissing` placeholder로 존 판정에 들어가고, 부족분 보충은 기존 채우기 규칙을 따른다.

## "고려"의 해석 (판단 근거)

- OpenRouter 사용량이 있으면 usage 근거로 1순위, 없으면 OpenCode Data 토큰을 보조 usage로 쓴다(`letter-top10-worker.ts` usage 폴백). 출처 규모가 다른 두 지표를 섞지 않기 위한 우선순위다.
- 보충 순서는 기존 채우기 규칙(top10-scoring.md §3, 2026-10-13 사용자 결정 "지수 결측 그룹은 맨 뒤에서 점수순")을 유지한다.
  즉 존 통과·지수 보유 후보를 먼저 놓고, 근거 백업 AA 미측정 후보는 그다음 점수(usage 반영)순으로 채워진다.
- 표시 열(지수·단가)은 새로 쓰지 않으므로 레터 예산(3,600자)에 영향이 없다. AA 미측정 행은 지수 `‑`, 단가는 결측 그대로다.

## 실측 검증 (2026-10-13, DB 사본 /tmp/yoroi-p7.BOhred/yoroi.db — 5소스 reused, 네트워크 미사용)

- 후보 풀 184 → **208**(근거 유지 +24). 카탈로그 접근·AA 미측정·근거 보유 4모델 확인: qwen3-8-flash·hy4-preview(OpenRouter), space-bunny·nemotron-3-ultra(OpenCode tokens).
- 역할 후보 풀 내 순위(지수 보유 후보 뒤 보충권): 오케 hy4 24/55 · space-bunny 28 · nemotron 41 · qwen3-8-flash 45 / 워커 hy4 23 · space-bunny 27 — 모두 근거 usage로 정렬된다.
- 두 역할 Top10은 **10행 유지**. 근거 후보는 현 데이터에서 Top10 미진입(지수 보유 미달 후보가 10행을 채움) — 채우기 정책 유지의 결과다.
- 근거 행은 단가 판정·후속 세대 교체 판정(`olderGenerationModelIds`)의 모델 집합에도 포함된다.

## 검증 명령·결과

- `pnpm run test` 875/875, BDD 41/41, typecheck, build 통과. 추가 테스트 `tests/insights-top10-unmeasured.test.ts`(풀 유지·usage 정렬·렌더 반영·placeholder 중복 없음).
- 스크립트: `scratch/tmp-o2/probe-unmeasured.ts`(근거 실태).
- 파이프 경로: `run-once.ts`(opencode-data 최신 일 rows 노출) → `letter-top10-render.ts`·`letter-markdown.ts`(입력 전달) → `insights-cli` 스프레드로 자동 반영.