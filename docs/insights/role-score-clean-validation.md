# 정규 보정 clean 검증 (1.0.2)

- clean `/tmp/yoroi-normal-clean` = origin/main `698898767` archive + **75 allowlist**(tracked diff − 제외 + untracked − 제외). manifest 75파일 해시. 버전 1.0.2.
- allowlist: tracked 변경 전부(`docs/orchestration.md` 제외) + untracked 문서/테스트(`orchestration-takeover`·`worker-effort-source` 제외). 누락 필수 테스트(markdown·markdown-legend·render-top10·top10-render·top10-price-policy) 포함.
- worker hunk: `score.ts`(aaFallback)·`four-source`(성능/워커행) 역적용 제거 확인.

## full check (clean)
- typecheck 0, unit **1041/1041**, BDD **45·632**, build PASS, `node dist --version` = **yoroi 1.0.2**.
- validate: clean 자체 스크립트 PASS **672** / 원본 repo PASS **673**.

## 보존·제외
- 원본 dirty5 해시 보존(값 미노출): four-source `e1cbe073…`·orchestration `f6ff5155…`·score.ts `0f766be8…`·takeover `bcbb80d2…`·worker-effort `303ced25…`.
- 제외: `docs/orchestration.md`·`orchestration-takeover-20261015.md`·`worker-effort-source.test.ts`. orphan/unknown 없음.
- staging: 기존 stale index 사용 금지, clean 기준 새 staging 후속. git index/branch/commit/push/원격 변경 0.
