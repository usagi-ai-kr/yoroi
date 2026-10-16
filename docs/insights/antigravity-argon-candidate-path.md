# argon 레터 후행 후보경로 (w1 읽기전용 조사, 2026-10-16)

- 근거: [배정](antigravity-argon-assignment.md) + [#165 확정코멘트](https://github.com/qus0in/yoroi/issues/165#issuecomment-6206154424). 실측·DB전체dump 없이 **코드 + 기존 공개보고**만으로 조사. 실제 카탈로그·score·source·tests 변경 없음, Arena 소스 복구 안 함. 선택은 **현재 사용자 답변 대기**.

## 1. 코드 조사 (4대 항목)

- **plan-catalog verified 자격**: `buildCandidatePool`(`letter-top10-candidates.ts:52,55`)의 `accessible` = `catalog`에서 `verified:true`만. **`gemini-4-argon`은 `plan-catalog.ts`에 없음**(antigravity plan은 gemini-3.8/3.7/3.6/3.1·claude·gpt-oss만) → `accessible` 탈락 → **후보 불가**. catalog 추가 형식: antigravity plan `models`에 `'…|gemini-4-argon'` 1항목 → `mDocs(...)`가 `verified:true·ANTIGRAVITY sourceUrl` 자동 부여.
- **normalizeModelName**(`model-id.ts:42`): 소문자·vendor 제거·숫자 사이 `.`→`-`. `gemini-4-argon`은 이미 정규형 → **변환 불필요**(별칭 없이 동일 id로 통과).
- **AA 결측 시 OR·OCD 후보 유지정책**: **이미 구현**(2026-10-13). `buildRoleVariants`(`candidates.ts:68-86`): `EVIDENCE_METRICS=['total_tokens','opencode_data_tokens']`(OR·OCD) 근거행이 있으면 AA 미측정 모델도 후보 유지 → `indexMissing:true, value:0` placeholder. `top10-policy.ts:5`도 동일 명시.
- **기존 score·모집단·Top10 결측 흐름**: 결측 → `value: aa ?? 0`(`score.ts:72`) → 0점(재분배 없음). orchestrator `PERFORMANCE_FLOOR=undefined`(`score-policy.ts:42`)라 **결측0도 floor 통과** → 후보 유지. 다만 점수 낮아 `belowZone = score < cutoff`(raw max×.85/.60) → **주 Top10이 아니라 ▽ 하한보충 행**으로 표시, 지수 칸은 `indexMissing` → `-` 대시(`markdown-legend` 패턴). worker는 `WORKER_PERFORMANCE_FLOOR=0.7`이라 결측0은 탈락.

## 2. 실측 vs 코드/공개보고 구분 (DB dump 안 함)

- **메신저 실측**: "argon AA 행0 / OR 근거" — 메신저가 본인 경로로 관측한 값. **나는 전체 DB dump로 재검증하지 않음**.
- **코드 근거**: 위 유지·결측 흐름 정책은 이미 존재(재검증 불필요, 구조만 확인).
- **기존 공개보고**: `docs/insights/`의 argon 문서는 **라벨 3건**(assignment·label-review·label-progress)뿐, **argon score·AA·OR 근거 공개보고는 없음** → 실측이 공개보고로 교차검증되지 않음(실측 단독 주장).

## 3. (a) vs (b) — 최소수정·fixture·catalog 근거

| 항목 | (a) AA 측정 대기 | (b) OR 근거 후보 등록 + 성능 결측 |
| --- | --- | --- |
| 최소 수정 파일 | **`plan-catalog.ts` 1곳**(antigravity에 argon 1항목) | **`plan-catalog.ts` 1곳**(동일) — `candidates.ts` 유지정책 이미 존재·무수정 |
| upstream 조건 | AA가 argon 지수 측정 발행 대기 | argon OR·OCD 근거행(`total_tokens`/`opencode_data_tokens`) 존재(실측 주장, 미검증) |
| 필요 fixture | test에 catalog 주입(`buildCandidatePool(rec, catalog)` 카탈로그 파라메터) + argon AA record. 기존 패턴(`insights-model-aliases`·`insights-free-unmeasured-alias`) 준용 | 동일 catalog 주입 + argon OR·OCD evidence행. 실 catalog 무변경으로 주입 가능 |
| 결측 결과 | AA 반영 후 실측 점수 → 정상 등급·Top10/▽ 판정 | 성능 결측 `value0·indexMissing` → orchestrator 통과·▽행(지수 `-`), worker는 floor 0.7 탈락 |
| catalog 근거 충분? | **부족** — argon 미등재. 공식 페이지(`antigravity.google/docs/models`) argon 게재 + AA 검증 필요 | **부족** — 동일. 추가로 OR·OCD 근거행 존재 근거 필요(실측 단독) |

## 4. 판정

- 두 안 **공통 1순위 블로커 = `plan-catalog.ts` argon 미등재**(verified 자격 없음 → 어느 안도 후보 불가). 후보 유지·결측 흐름 정책은 코드에 이미 존재해 **score/candidates 수정 불필요**.
- (a)는 AA 실측 대기, (b)는 실측 없이 OR 근거 + 성능결측(▽·지수 `-`)으로 조기 표기. **둘 다 catalog 근거 현재 부족**.
- **선택은 현재 사용자 답변 대기** — 이 문서만 제출하고 자동 후속 없음.
