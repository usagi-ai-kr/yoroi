# R clean 1.0.2 검증·커밋 계획 (w1, 2026-10-16)

- ownership: 이 패킷으로 3개 core(score-policy·score-raw·score) 일시 인계 — 렌더는 w2 read-only.
- 범위: 레거시 주석 정정(완료) + clean 릴리스 계획만. git index/branch/commit/원격 **미변경**. clean 검증은 별도 패킷.

## 1. 레거시 주석 정정 (실행코드 변경 0)

- `score-policy.ts:11` 82/6/12·가성비제거 → **70/5/10/15·가성비 복구 I/(P+.01)**.
- `score-raw.ts:56` "성능·속도…가성비 제거" → **성능·속도·가성비 같은 effort·복구**.
- `score.ts:68` "오케 가격 차원 없음" → **오케 가성비 결측 0·보정 없음**.
- 증거: 3곳 모두 주석(`/**`,`*`,`//`) 라인만 교체. typecheck·핵심 테스트 dimension-contract+c-policy **15/0 동일**(behavior 무변경).
- 참고: `score-policy.ts:9` ROLE_DIMENSIONS 주석 "세 칸"도 사실상 stale하나 지시 "3곳만"에 따라 미수정 — 후속 결정 사항.

## 2. base·dev 동기화

- base = **main `698898767c15f2da18cb6cbdb18ff9e8ca969f21`**(69889876, PR #161 merge).
- dev = `3fd554981c…`(3fd5549)로 main보다 뒤 **1커밋**(merge commit만). 내용은 dev에서 갈라져 main에 머지됨 →
  dev 동기화안: release 전 `git merge --ff-only origin/main`(또는 rebase)로 dev를 main 동기로. main 직접 push 금지.

## 3. 릴리스 allowlist (R 1.0.2 변경 파일, worker hunk 제외 대상)

- core: `config/score-weights.json`, `letter-top10-score-{policy,raw,weights}.ts`, `letter-top10-score.ts`.
- render: `letter-markdown-format.ts`, `letter-markdown.ts`, `letter-top10-legend.ts` (·`letter-top10-render.ts`는 w2 compact 진행중 — 포함여부 w2 확인 후).
- tests: `dimension-contract`, `c-policy`, `orchestrator-effort`, `top10-*`, `orchestrator-value-render`(신규), `helpers/dimension-reference.ts`.
- docs: `four-source-score`, `score-weights`, `top10-scoring`, `letter-issue` + 연구문서4종 + 이번 진행docs(아래 6).
- `package.json`(버전 1.0.2). **제외**: 원천 snapshot·private backup(`scratch/`, `/tmp/*backup*`).

## 4. worker hunk 제외 + 나머지 dirty 보존 (backup·actual diff 기준)

- 백업 dirty5(`/tmp/yoroi-r-preflight-backup/`, SHA256 검증): `letter-top10-score.ts`, `four-source-score.md`,
  `insights-worker-effort-source.test.ts`, `orchestration.md`, `orchestration-takeover-20261015.md`.
- worker hunk = p85 **워커 cpt·total 가격·성능=AA Intelligence만** 라인(score.ts PARTS aaCpt/aaTotal·baseWorkerPrices,
  four-source 워커 행, worker-effort 테스트) — R과 **동일 파일 교차**(score.ts diff 18줄, hunk 분리 가능).
- 제거 방법(역적용): (a) 현재 worktree `git diff > /tmp/r-full.patch`; (b) backup 원본으로 `git apply -R` 후
  R hunk만 재적용 OR (c) backup 원본 대비 R-정본을 만들어 `git diff backup R-정본 > worker.patch`, `git apply -R worker.patch`.
  코드 손실 방지: 전후 SHA256 기록 + `git apply --check` 선검증, 실패 시 backup에서 복원.

## 5. 임시 clean archive·릴리스 include 범위

- `main 698898767` 클린트리 복제 → allowlist 중 **정 파일만 복사**, worker hunk는 4의 역적용으로 제거 → clean 1.0.2 트리.
- include 제안: 위 allowlist + **리서치 문서 4종**(`orchestrator-value-restoration`, `-weight-{study,baseline,comparison}`) +
  이번 진행docs 4(`orchestrator-r-{test-contract,render,core-review,clean-plan}`).
- exclude: 원천 대용량 snapshot·개인 사용량·비밀값·private backup.

## 6. 유보·후속

- renderer(`letter-top10-render.ts`·compact)는 w2 수정중 read-only — 1.0.2 포함 여부·compact 예산실패는 별도 후속.
- 본 계획 단계는 git 무변경. 다음 clean 검증(격리 트리 단위·BDD·CLI 1.0.2·공개 고정입력 비교)은 별도 패킷.
