# 남은 병목 작업 분배 (2026-10-16, o=p13)

기준: dev `f72a404`(병목 규칙 정리, push 완료), main `fe0c009`(#172 머지).
공통: 소유 파일만 수정한다. 커밋·push·PR·머지·외부 쓰기는 하지 않는다(o가 통합). 끝나면 보고서 JSON을 쓴다.

## w1 (p17) — 이전 세션 effort 미커밋분 판정 `yoroi-effort-dirty-w1`

- 대상(읽기 전용): `src/insights/letter-top10-score.ts`·`docs/insights/four-source-score.md`의 미커밋 diff, `tests/insights-worker-effort-source.test.ts`(untracked).
- main에 이미 머지된 `aba39d9`(워커 effort 표기를 AA 측정 변형에 맞춤 1.0.3)와 비교해 **중복 / 보완 / 충돌** 중 무엇인지 판정한다.
- 실행: `npx tsx --test tests/insights-worker-effort-source.test.ts`와 관련 레터 Top10 테스트. 실패 시 원인 1–2줄.
- 산출: 판정·근거·권고(커밋 / 폐기 / 수정 후 커밋)를 `docs/insights/effort-dirty-review-20261016.md`(≤40줄)에 쓴다. 소스는 수정하지 않는다.

## w3 (p19) — 남은 병목 규칙 정리 `yoroi-harness-bottleneck-w3`

사용자가 규칙 수정을 전부 허용했다(2026-10-16). 범위:
1. **인수 시 이전 패킷 회수**: `.agents/skills/agent-coordination/SKILL.md`에 다음을 넣는다. 오케를 인수하면 보고서가 없는 기존 패킷을 목록화하고, 담당 워커에 중단·회수를 통지한 뒤 재배정한다. 같은 작업을 두 경로가 동시에 하지 않게 한다(#172 이중 처리 사례).
2. **커밋 절차 경량화**: `.agents/skills/github-workflow/SKILL.md`에 다음을 넣는다. 커밋은 경로를 지정한 `git add <files>`로 한다. 사용자 변경과 섞이면 경로 제외로 충분하다. private index·manifest·해시 대조는 기본 절차가 아니라 필요할 때만 쓴다.
3. **메신저 경유 완화**: `AGENTS.md`의 메신저 문단에 "사용자가 오케스트레이터에게 직접 지시하면 메신저 경유 없이 처리한다"를 넣는다.
- 제약: 파일당 100줄 이하, 스킬은 재사용 가능하게(레포 값 금지), 수정한 스킬은 `metadata.version`을 올린다. `python3 scripts/validate-repo.py` PASS.

## w2 (p18, free tier 잡무) — #172 기록 통합 `yoroi-pr172-records-w2`

- 입력: untracked `docs/insights/harness-pr-ci-record.md`·`harness-merge-main-ci-record.md`·`harness-final-audit.md`.
- `gh pr view 172`와 `git log origin/main -1`(fe0c009)로 사실을 대조한다. PR URL·head `f046ece`·CI run·머지 SHA를 확인한다.
- 산출: `docs/insights/harness-pr172-record.md`(≤30줄) 하나로 통합하고, 사실과 다른 항목을 표시한다. 원본 3건은 삭제하지 말고 보고서에 "삭제 후보"로 적는다.
