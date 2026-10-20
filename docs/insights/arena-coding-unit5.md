# #190 단위E — Arena 코딩 근거 어댑터 (2026-10-20)

- 범위: Arena 코딩 행을 **선택적 추가 근거**로 쓰는 어댑터. **단위E이며 #190 전체 완료를 뜻하지 않는다.**
- 소유: `src/insights/letter-arena-evidence.ts`·`tests/insights-letter-arena-evidence.test.ts`·본 문서.
- **기존 AA·OpenRouter·OpenCode Data·Cognition 소스를 대체하지 않는다. 현재 발행 레터 출력은 그대로다(기본 꺼짐).**

## 1. 계약

- 입력: `ArenaCodingRecord` 행(단위A 모델 계약) → `toArenaEvidenceRow`로 근거 행 변환.
  출처 id·지표·`arenaSubset`·`arenaCategory`·`effortQualifier`(날짜 한정자)를 **그대로 보존**한다.
- 출력: `buildArenaEvidenceBundle(records, options)` →
  - `enabled`(기본 false)·`policyReady`·`rows`·`attribution`(arena 전용 출처 한 줄)·`identities`(복합 식별키)·`blockedReason`.
  - `mergeArenaEvidence(existing, bundle)` → 기존 근거 행을 **그대로 두고** arena 행을 뒤에 붙인다(덮어쓰기 없음).
  - `buildCandidatePoolWithArena(records, catalog, existingEvidence, lists, bundle)` → 기존 `buildCandidatePool`에 병합 근거만 넘긴다.
- **복합 식별**: `subset|category|modelId|effortQualifier` 키. 같은 모델명이라도 subset·한정자가 다르면 다른 항목(병합 금지).

## 2. 기본 꺼짐·fail-closed

- `enabled` 기본 false → 번들이 비고 후보 풀·출력이 기존과 **완전히 동일**하다(테스트로 확인).
- 켜도 `ARENA_EVIDENCE_METRICS`(`arena_coding_rating`·`arena_coding_score`)가 근거 정책
  `EVIDENCE_METRICS`에 등록되기 전이면 `policyReady=false`·`blockedReason`을 남기고 **반영하지 않는다**.
  근거 지표를 일반 점수처럼 넣으면 점수·임계값이 오염되므로, 정책 등록은 별도 단위(가중치·임계값 변경 금지 원칙)에 맡긴다.
- 가중치·임계값·점수 산식은 이 단위에서 **변경하지 않는다**.

## 3. 검증 (합성, 네트워크 0)

`tests/insights-letter-arena-evidence.test.ts` 7건: 근거 행 변환(지표·subset·category·한정자 보존) / 기본 꺼짐 시 후보 경로 동일 /
정책 미등록 시 fail-closed·기존 행 보존 / 기존 행 덮어쓰지 않고 뒤에 부착 / 출처 귀속이 arena 전용으로 분리 /
유사 이름·다른 subset·다른 한정자 병합 없음(3개 키) / 결정성.

- `node --import ./tests/harness-setup.mjs --import tsx --test tests/insights-letter-arena-evidence.test.ts` → **7 pass / 0 fail, exit 0**
- `pnpm run typecheck` → 내 파일 오류 0건 · `python3 scripts/validate-repo.py` → PASS · `git diff --check` → clean
- 작성 파일 100줄 이하(어댑터 66줄·테스트 85줄·본 문서)

## 4. 남은 범위(#190 미완료)

1. 근거 정책 등록(`EVIDENCE_METRICS`에 arena 지표 2종) — 가중치·임계값 변경 금지 원칙에 따라 별도 승인 단위.
2. 후보 풀 반영 경로 연결(단위E 어댑터를 run-once 경로에서 호출) — 미구현.
3. 레터 근거 행 표시(arena 근거 표기·출처 라인 병합) — 미구현.
4. 저장 계통과 레터의 arena 라인 분리 재검증 — 미구현.
