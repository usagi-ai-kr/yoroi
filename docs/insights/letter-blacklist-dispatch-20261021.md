# GLM 5.3 / Kimi K3 blacklist (2026-10-21)

- User explicitly requests glm5.3 and kimi k3 be blacklisted.
- Exclude exact canonical models glm-5-3 and kimi-k3, including aliases, efforts and provider/free suffixes.
- Keep GLM 5.3 Flash eligible; do not use a broad GLM prefix ban.
- Apply the existing common letter blacklist to all roles, tables, recommendations, runners-up and fallback.
- This request supersedes prior preservation of the banned models in rankings/tables.
- Retain open-weight union verified Free pool and at least one verified Free worker in each of 4 combinations.
- No forced DeepSeek O, no forced Beam, no invented unmeasured scores.
- Preserve existing WIP. No README/AGENTS changes; authored files <=100 lines.
- No commit/push/PR/publication/external write without user approval. 0.3.x/Postgres stays stopped.

## Owners and checks

- w1: config/letter-model-lists.json, src/insights/letter-model-lists.ts and necessary letter-filter wiring/tests.
- w1 retains existing letter WIP ownership. Add narrowly scoped helpers/tests as needed and report paths.
- w2: independently audit actual catalog to upper output and prepare/send the final r review packet.
- r: final independent review; root only assigns and aggregates reports.
- w1 updates tmp/letter-20261021-union-free-draft.md through actual upper generator with the blacklist active.
- Verify aliases/effort exclusion and GLM Flash retention, all tables/4 combinations/runners/fallback absence.
- Required: pnpm run check, python3 scripts/validate-repo.py, git diff --check.
- Report implementation, actual output and any unresolved behavior, not only synthetic score arrays.
- Progress: docs/insights/letter-blacklist-result-20261021.md. No unrelated issue/release work.

## Latest user delta

- Also blacklist mimo-v2-6-pro, including canonical aliases/effort/free/provider variants.
- Allow gpt-6-luna and claude-haiku-5-5 as orchestrator; remove their existing role-specific bans
  from both repository config and defaults.
- Remove artificial O targeting, forced O candidates, O-first weighting or arbitrary preselection if present.
- Use natural total-score assignment under the current explicit policy constraints. Do not add O weighting.
- Preserve the user-confirmed open-weight/Free union and Free worker >=1 policy; do not reinterpret
  that explicit requirement as an obsolete O optimization.
- Recalculate all tables, combinations, runners and draft after this delta; previous totals are historical.
- Revalidate #267 explanation against the newest pool. Prior MiMo Pro O explanation is now obsolete.
- User explicitly approved ONE #267 explanation comment after r verification. Commit/push/PR/letter
  republication remain prohibited. Do not post an obsolete intermediate explanation.

## w2 독립 감사 결과 (읽기 전용, 2026-10-21 · 최신 DELTA 기준)

- **인위적 O 유도/강제/선별 로직: 없음** ✓ — 역할 선택·조합 경로에 모델명 하드코딩 0건 ✓ ·
  O 슬롯 force/prefer/reserve 로직 0건 ✓ · 조합 배정은 전수 탐색 합산 최대(`letter-team-combinations.ts:66`) ✓.
- **유지되는 제약(사용자 확정)** ✓ — 워커 verified Free ≥1(`letter-team-combinations.ts` 열거 제약 ✓) · 오픈 웨이트 ∪ verified Free union 풀 ✓ · 공통 밴 ✓.
- **제거 대상은 역할별 밴뿐** ✓ — 오케스트레이터의 `gpt-6-luna`·`claude-haiku-5-5` 밴(설정 + 기본값 양쪽 ✓) → DELTA대로 해제 ✓.
- **AC 정정** ✓ — 이전 합산·수치(347.10·201.90·309.69·178.27 등)는 **과거치로 폐기** ✓ · DELTA 후 표·조합·차선·초안을 재생성해 관측값으로만 기록 ✓ ·
  `mimo-v2-6-pro` 추가로 open-1+1+3 값은 달라질 수 있음 ✓.
- **#267 설명** ✓ — MiMo Pro O 설명은 신규 밴으로 무효 ✓ → 최신 풀로 재검증 후 승인된 1건만 ✓(오래된 중간 설명 게시 금지 ✓).
- 재현 스크립트(읽기 전용) ✓ `/tmp/audit-ban.mjs` — 표준 경로 실측: banned 0건 · glm-5-3-flash 유지 ✓.
