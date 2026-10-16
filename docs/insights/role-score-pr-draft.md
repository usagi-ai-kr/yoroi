# PR 초안 기록 (w3, yoroi-normal-doc-pr-draft-w3)

- PR: https://github.com/qus0in/yoroi/pull/166 — draft, OPEN, base `main`, head `dev`, label `fix`, 연결 이슈 닫기 0건.
- 제목: `fix: 오케 가성비 복구와 역할별 정규 점수 보정 (1.0.2)`
- head: `c9fde22a10fd96b313d3172e054d06246719d160` (commit-push w2 보고, origin/dev 일치 확인, gh `headRefOid` 일치).
- base: `main` `698898767c15f2da18cb6cbdb18ff9e8ca969f21` (origin/main 불변).

## 1. 가격 방향 칸 (four-source-score.md, 가격 키 행의 변환 칸)
| 위치 | 상태 | 값 |
|---|---|---|
| PR head c9fde22 | 잔여 | `log10` |
| ROOT 워킹트리 | 적용됨, 미커밋 | `오케 AA log10(I/(P+.01)) 정방향 · Cog USD/task 역방향 / 워커 log10(v+.01) 낮을수록` |
| 패치 | 준비됨 | `/tmp/yoroi-worker-price-doc.patch` (`git apply --cached --check` 통과) |

- 성능 행과 워커 dirty 행은 손대지 않았다. 사용자 보존 대상이다.
- ROOT 편집 시점: `/tmp/yoroi-normal-commit-push-w2-report.json` 존재 확인 후.

## 2. 후속 조건 (사용자 승인 필요)
1. 가격 칸 복원을 PR head에 반영하는 후속 doc 커밋이 필요하다. 로컬 commit과 push는 이 작업에서 허가되지 않았다.
2. ROOT에만 있는 렌더 문구 변경(letter-markdown-format.ts 가중치 문구, tests/insights-top10-render.test.ts 단언)의 포함 여부를 결정해야 한다.
3. 실제 예산(컴팩트 3600/3800): ROOT 기준 3개 파일 15/15 PASS. c9fde22 기준은 w2 클린 전체(unit 1041/1041)에 포함된다고 보고되어 인용했다.
4. draft 해제, 머지, tag, release, 전역 CLI 갱신, 레터 발행은 하지 않았다. 사용자 승인 후 진행한다.

## 3. ROOT 워킹트리와 PR head(c9fde22)의 차이
- 코드·테스트: `src/insights/letter-markdown-format.ts`, `src/insights/letter-top10-score.ts`(워커 dirty, 보존), `tests/insights-top10-render.test.ts`.
- 문서: `docs/insights/four-source-score.md`(가격 칸 + 워커 dirty 행), `docs/insights/role-score-final-review.md`, `docs/insights/role-score-release-prep.md`(타 워커), `docs/orchestration.md`(dirty5, 보존).
- 미추적: `docs/insights/orchestration-takeover-20261015.md`, `tests/insights-worker-effort-source.test.ts`(dirty5, 보존).

## 4. 검증
- `gh pr view 166`: isDraft true, state OPEN, headRefOid `c9fde22…`, labels `[fix]`, closing refs 0.
- 원본 dirty5: 3개는 백업과 동일, 2개는 백업 이후 R 편집으로 상이(이전 감사 기준). 삭제 없음.
- 정적 확인: 가격 칸에 `log10 | 오케 max` 잔존 0건, 신규 칸 1건.
