# 최종 하네스 + 발행완료 docs 후보 (w1, `yoroi-harness-final-candidate-w1`, 2026-10-16)

- 범위: v1.0.3 main/tag 기반 **clean 후보 준비**(커밋·push 없음). w1 스킬 리뷰·w2 코드 리뷰 완료 확인, w3 최종 리뷰는 병렬 read-only 진행.
- base: main = tag `v1.0.3` = `ea381c61b794390c43ac85cc2b515f0022c1af2a`. package.json 1.0.3(정합).

## 후보 (오버레이 42파일)

- dest `/tmp/yoroi-harness-final-clean` · builder `/tmp/yoroi-harness-final-build.py`(39줄) · manifest `/tmp/yoroi-harness-final-manifest.json`(파일별 sha256).
- **포함**:
  - harness code/test: `coord_completion.py`·`coord_completion_state.py`(w2 리뷰 반영: 300s 예산·전이 즉시 감지)·`coord_herdr.py`, `tests/coord-completion.test.ts`
  - skills/rules: harness-improvement(+`agents/openai.yaml`)·agent-coordination·coordination-rules SKILL, `AGENTS.md`, `docs/skills.md`
  - harness docs: completion-incident(-task)·improvement-policy(소유 교정)·code/skill independent review
  - 발행완료 docs: `release-102-*`·`release-103-*`(pr-ci·merge-main-ci·publication·global-update·letter-*·completion 등) + `release-status`·`tasks`
  - **이전 제외 7건(내용 확인 후 포함)**: active-worker-assignment·adaptive-model-discovery-issue(#168 기록)·handoff 3건·letter-ban-implementation-plan(#163 기록)·uncommitted-preservation-review
- **제외 dirty5(원본 보존, 후보는 main 1.0.3 버전)**: score(승인 fallback)·four-source·orchestration·takeover·worker-effort-source.test. generated·scratch·raw·env·tmp 미포함.

## 정합·교정 (소유 파일)

- `harness-improvement-policy.md` 1회 루프 문구에 "**bounded 교정·재검증은 루프 내 허용**(범위 확장 금지)" 단서 추가 — 스킬 최신 문구와 정합(소유권 w2→w1 전달). 이전 1800s 언급 보고서는 당시 관측으로 유지, 최신 예산은 코드 300s·coord-cli 문서와 일치.
- 신호 정합 확인: coord-cli(exit 4/5/6·300s 누적·최초 send 앵커·no-looping) ↔ 코드·회귀 테스트 일치.

## 검증

- **후보**: unit **1068/1068** · typecheck PASS · validate-repo PASS(752 files·8 skills) · docs-links PASS · python coord 4종 PASS · skill validate·portability PASS.
- **BDD 45/632 · build는 재사용**: 후보 `src/` 173파일·앱 `tests/` 249파일 sha256이 ea381 태그와 **완전 일치**(불변)·package.json 동일 → 1.0.3 발행 증거 그대로 유효(반복 불필요).
- 파일 줄 수: builder 39 · 포함 파일 전부 ≤100.

## 보존·후속

- ROOT dirty5 해시 불변(score `0f766be8…` 등), 생성물·scratch 미포함. stage/commit/push/PR/merge 없음, 타 워커 source 수정 없음.
- 후속: w3 최종 리뷰 → 커밋 분리(사용자 승인 흐름). 보고 후 대기.
