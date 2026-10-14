# p72 분배: 묶음 커밋·레터 재발행·0.10.0 릴리스 (2026-10-14 사용자 결정 2.b·3.b·범프)

o(`w12:p13`)는 분배·진척만 맡는다. 보고는 각 패킷 `report_path` JSON, 최종 요약은 `scratch/reports/yoroi-p72-commit-letter.md`(o 작성).

## 현재 상태 (o 확인)

- 브랜치 `feat/opencode-v2`. o가 사용자 확인 후 묶음 커밋 4건을 만들었다(push 없음).
  `e05522c` 인사이트 가중치 · `b1df38f` limit·c-5h 라벨 · `7dddd79` SQLite BUSY 기한 · `70e0353` 매시간 사용량 보고.
- 남은 미커밋: 묶음 5(협업 CLI·규칙), 묶음 6(나머지 문서).
- `pnpm test` 940/940, `validate-repo.py` PASS(563 files).
- 결함: `test_coord_digest.py` 실패 — `coord_digest.py`가 없어진 `coord_herdr.load_roster`를 호출한다.
- 레터 본문: `scratch/reports/letter-2026-10-14.md`(워킹트리 렌더, 가중치 70/5/10/15, AA 부분 수집 경고).
- origin: main `9b86ab4`. dev는 main보다 4커밋 뒤(ff 가능). HEAD는 main에 없는 커밋 7개.

## 1단계 (병렬)

| 담당 | 작업 | 소유 |
| --- | --- | --- |
| w2 | `coord_digest.py` 로스터 로딩을 `coord_workspace.parse_entries` 기반으로 고친다. 테스트 통과 | `coord_digest.py`, `test_coord_digest.py` |
| w3 | 레터 재발행(아래 절차) | GitHub 이슈 #131·새 letter 이슈 |
| w4 | 리뷰: 커밋 4건의 묶음 경계(남의 작업 혼입)·메시지와 diff 일치 확인 | 보고서만 |
| w1 | 묶음 6 커밋: `docs/architecture.md`, `docs/development.md`, `docs/tasks.md`, `docs/opencode-v2-migration.md` | 해당 파일 git add·commit |

경로 접두 `.agents/skills/agent-coordination/scripts/`.

### 레터 재발행 절차 (w3)

1. `gh issue comment 131`으로 "가중치 70/5/10/15·사용량 열 반영본으로 재발행" 후속 안내를 남기고 `gh issue close 131`.
2. `gh issue create --title "[letter] 2026-10-14 AI 인사이트 레터" --label letter --body-file scratch/reports/letter-2026-10-14.md`.
3. `insights publish`는 쓰지 않는다(같은 제목 skip). 본문 수정 금지. 다른 이슈 수정 금지.
4. 보고: 새 이슈 번호·URL·발행 시각(KST).

### 1단계 결과·추가 (o)

- w2 PASS(digest 3/3). w3 발행 [#138](https://github.com/qus0in/yoroi/issues/138) 14:13:38 KST, #131 댓글·close.
- w3 추가: `coord.py watch`가 `--reports` 뒤 `--interval 20 --max-polls 60`의 값까지 보고 경로로 잡아
  라벨 수와 어긋나 exit 2. 옵션 값은 보고에서 빼고 watch_workers.sh로 넘긴다. 소유 `coord_herdr.py`, `test_coord.py`.

- w3 PASS(watch 옵션 분리, test_coord 9). w4 리뷰 4건 PASS(경미: e05522c '대표 effort 상한'은 실제로 상한 폐기).
- w1(codex) blocked: 자동 승인 검토가 `git add` 거부 → 사용자 권한 사항. 2단계와 묶음 6은 w2가 맡는다.

## 2단계 (w2: w2b=0~2 커밋, w2c=3~5 dev·PR 후 정지)

0. 묶음 6 커밋(위 1단계 w1 표의 4개 문서, w1 수정 보존).

1. 묶음 5 커밋: `.agents/skills/agent-coordination/**`, `docs/insights/coord-cli.md`, `token-savings.md`,
   `worker-dispatch.md`, `p64`~`p72-dispatch.md`, `docs/orchestration.md`, `docs/wiki-pages/Worker-Operations.md`.
2. `package.json` 0.9.0 → 0.10.0, roadmap 문서 갱신을 한 커밋으로(근거: 가중치 외부화, 오케 사용량 차원·열, c-5h 라벨, 분배 CLI).
3. `dev`를 `origin/main`으로 ff한 뒤 `feat/opencode-v2`를 merge(충돌 시 중단·보고). `pnpm test`, `validate-repo.py`.
4. `git push origin dev` 후 dev → main PR 생성. main 직접 push 금지.
5. PR 본문에 경미 ① 정정 한 줄. PR CI 결과까지 보고하고 멈춘다. w4가 PR 리뷰, 머지는 o가 사용자 확인 후 지시.
6. main CI 통과 확인(`gh workflow run ci.yml --ref main` 필요 시) → tag `v0.10.0`·Release → 전역 CLI 갱신(`global-cli-update` 스킬)·버전 일치 확인.

## 공통 금지

모델·세션 변경, 실제 유료 API 호출, 시크릿·개인 사용량 원본 노출, 소유 밖 파일 수정, 파일당 100줄 초과.
커밋은 w1만 한다(인덱스 충돌 방지). 사용자 결정이 필요하면 멈추고 보고한다.
