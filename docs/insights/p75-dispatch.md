# p75 분배: 오케 가성비 제거(b) + Free 티어 한 표 → 레터 재발행 (2026-10-14 사용자 지시)

o(`w12:p13`)는 분배만 맡는다. 최종 요약: `scratch/reports/yoroi-p75-price-out-and-free-table.md`(o).
이 작업은 p74 재발행보다 우선한다. p74는 이미 #138에 반영됐다.

## A. w1 — 오케 가성비 제거

- 가중치:
  - `config/score-weights.json` orchestrator를 성능 0.82·사용량 0.06·속도 0.12로 바꾼다. 70:5:10을 비례 재배분한 값이다.
  - 가성비(price) 키를 제거한다. 워커 30/20/10/40은 그대로 둔다.
  - 코드 기본값(`letter-top10-score-weights.ts` 등)도 같은 값으로 맞춘다.
- 표시:
  - 오케 표의 차원 열 머리를 `성능/사용량/속도`로 바꾸고 값도 세 칸만 쓴다.
  - 오케 가성비 문구를 표시 안내·산출 공식에서 지운다(legend·format·unified·render 쪽).
  - 가중치 줄은 새 값으로 고친다.
- **파레토 열은 현 상태를 유지한다.** 오케 파레토가 무엇을 기준으로 정해지는지(가성비, 혼합 단가, 다른 값) 코드 근거(파일:줄)로 보고만 한다. 사용자 결정 사항이다.
- 문서: `docs/insights/score-weights.md`, `four-source-score.md`, `top10-scoring.md`, `letter-issue.md`의 오케 가중치·가성비 서술.
- 테스트: 옛 가중치·가성비를 단언하는 `tests/insights-*` 테스트를 갱신한다(Free 관련 테스트는 B 소유).
- 소유: `config/score-weights.json`, `src/insights/letter-top10-*.ts`, `src/insights/letter-markdown-format.ts`, 위 docs, 해당 tests.

## B. w2 — Free 티어 한 표

- `## 🆓 Free 티어`를 한 표로 합친다. 지금은 `### 오케스트레이터·리뷰어`, `### 워커·메신저` 두 표로 나뉘어 있다.
- 열: `| 모델 | 오케 | 워커 | Free 경로 | 비고 |`. 영역 칸 표기:
  - 해당 영역 자격을 통과하면 `✓ 스코어`
  - 근거는 있는데 미달이면 `✗`
  - 근거가 없으면 `-`
- 정렬: 오케 통과 → 워커 통과 → 나머지 순이고, 그 안에서는 오케 스코어 내림차순 → 워커 스코어 내림차순 → 모델명이다. 다른 정렬이 낫다면 근거와 함께 보고한다.
- Free 경로·비고(⚠️ 세션 헤더 등)·티어 설명 두 줄·수집 실패 1줄 표시는 유지한다.
- 오케 스코어는 A의 새 가중치를 따른다. 구현은 스코어 함수를 호출만 하고, 가중치 값을 단언하지 않는다.
- 소유: `src/insights/letter-markdown-free.ts`(분리가 필요하면 `letter-markdown-free-*.ts` 신설), Free 관련 테스트
  (`tests/insights-free-*.test.ts`, `insights-opencode-free-models.test.ts`).
- A 소유 파일을 고쳐야 하면 고치지 말고 o에게 보고한다.

## C. 통합 검증·리뷰 (A·B 완료 후)

1. w4가 A·B를 리뷰한다. 구현자와 다른 워커다.
   - 확인 항목: 요구 일치, 가성비 잔재, Free 표 형식, 파일당 100줄
   - 실행: `pnpm run typecheck`, `pnpm run test`(실패 0), `python3 scripts/validate-repo.py`
2. w3가 레포 워킹트리 기준 `pnpm -s run dev insights once --markdown > scratch/reports/letter-2026-10-14-p75.md`로 렌더한다.
   `--refresh`는 쓰지 않는다. 렌더 결과에서 새 가중치·오케 3차원·Free 한 표를 확인한다.
3. w4가 #138 본문을 갱신하고 댓글 한 줄을 단다(오케 가성비 제거·가중치 82/6/12·Free 한 표).
   같은 날 레터를 한 이슈로 유지하려고 새 이슈를 만들지 않는다.

## 단계 재편 (사용자 지시: 몰아주기·장기 점유 방지, 앞 단계 보고 확인 후 다음 단계)

| 단계 | 워커 | 범위 | 보고 경로 | 착수 조건 |
| --- | --- | --- | --- | --- |
| 1A | w1 | A 구현(진행 중, 끊지 않음) | yoroi-p75-w1-report.json | — |
| 1B | w2 | B 구현 | yoroi-p75-w2-report.json | 완료 PASS |
| 2B | w4 | B 리뷰(Free 3파일·테스트, 읽기 전용) | yoroi-p75-w4b-report.json | 1B 보고 확인 후 |
| 2P | w3 | 오케 파레토 기준 독립 분석(읽기 전용, 파일:줄) | yoroi-p75-w3p-report.json | 1B 보고 확인 후 |
| 3A | w2 | A 리뷰·typecheck·전체 test(읽기 전용) | yoroi-p75-w2a-report.json | 1A 보고 확인 후(938 pass, 940→938 사유 확인) |
| 4 | w3 | 워킹트리 렌더 → `letter-2026-10-14-p75.md` | yoroi-p75-w3r-report.json | 3A·3F 보고 확인 후 |
| 3D | w1 | `four-source-score.md:33` '네 차원(오케는 단가 근거 포함)' → 오케 3·워커 4 | yoroi-p75-w1d-report.json | 3F 보고 확인 후 |
| 5 | 4와 다른 워커 | #138 갱신·댓글 | (발행 시 기재) | 4 보고 확인 후 |

| 3F | w4 | `letter-markdown.ts:46` 자격 문구 "네 차원" → 역할별 차원 수에 맞게(오케 3·워커 4), 단언 테스트 갱신 | yoroi-p75-w4f-report.json | 2B·2P·3A 보고 확인 후(모두 PASS) |

- 2P: w1·w3 모두 오케 파레토 = 실제 단가(effectiveCost ?? blendedCost) 대비 스코어(`letter-top10-score.ts:72-75`), 82/6/12 시뮬레이션에서도 파레토 7개 동일. 결정은 사용자.
- 3F PASS(자격 문구). 전체 937/1 fail = usage-history-store:84 타이밍 플레이크(단독 6/6, flaky-tests.md 기록).
- 남겨 둔 잔재(파레토 결정 대기): legend:37 `(가성비 경계선)`, unified.ts:47 미사용 `costEffRankText`.

## 후속 (사용자 결정 a: 잔재 정리 → 커밋 → 재렌더 → 발행, 단계별로 보고 확인 후 진행)

| 단계 | 워커 | 범위 | 보고 |
| --- | --- | --- | --- |
| 5C | w4 | 파레토 안내 '가성비 경계선' 문구를 오케와 어긋나지 않게 고친다(열 유지). `costEffRankText` 필드와 참조를 제거하고 관련 단언을 갱신 | yoroi-p75-w4c-report.json |
| 6R | w2 | 5C 리뷰 + `letter-issue.md:68` '(가성비 경계선)' 예시를 5C 문구 '(단가 대비 스코어 경계선)'으로, typecheck·전체 test·validate | yoroi-p75-w2r-report.json |
| 7K | w3 | 미커밋분 주제별 커밋 4건(아래 묶음, push 금지) | yoroi-p75-w3k-report.json |
| 8L | 배정 시 | 재렌더(`--refresh` 금지) | 배정 시 |
| 9P | 8L과 다른 워커 | #138 갱신·댓글 | 배정 시 |

- 5C PASS(w4, 938/938). 3D PASS(w1). 4단계 w3 렌더는 보고 없음·정리 전 코드라 폐기, 8L에서 재렌더.

- 6R PASS(w2, 938/938·typecheck 0·validate PASS, letter-issue.md:68 정정).

### 7K 커밋 묶음 (o 결정, 명시 경로만 git add, push 금지)

1. 오케 가성비 제거·잔재 정리: config/score-weights.json, src/insights/letter-top10-{score,score-raw,score-policy,score-weights,legend,unified}.ts,
   letter-markdown-format.ts, letter-markdown.ts, docs/insights/{score-weights,four-source-score,top10-scoring,letter-issue}.md,
   tests/insights-{c-policy,dimension-contract,markdown-legend,markdown,orchestrator-effort,top10-fill,top10-price-policy,top10-rank,top10-render,top10-source-policy,top10-unified,top10-unmeasured}.test.ts
   — 잔재 정리(5C·6R·3F·3D)는 같은 파일 hunk라 분리하지 않고 본문에 단계별로 적는다.
2. Free 티어 한 표: src/insights/letter-markdown-free{,-sort,-table}.ts, tests/insights-free-{section,global-top10}.test.ts
3. 분배 문서: docs/insights/p73-dispatch.md, p74-dispatch.md, p75-dispatch.md
4. 협업 규칙(메신저 변경, 몰아주기 방지): .agents/skills/agent-coordination/SKILL.md, docs/orchestration.md

1A 이후 남는 일(문서 잔여 등)은 w1에 다시 주지 않고 다른 워커로 돌린다. 경로 접두 `scratch/reports/`.

## 공통 금지

커밋·push, 실제 API 호출·`--refresh`, 모델·세션 변경, 시크릿 노출, 소유 밖 수정, 파일당 100줄 초과.
