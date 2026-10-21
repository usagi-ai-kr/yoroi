# 추천 조합 Top15·Free·차선 독립 리뷰 r (2026-10-21, #256·#257)

- 이슈: [#256](https://github.com/usagi-ai-kr/yoroi/issues/256), [#257](https://github.com/usagi-ai-kr/yoroi/issues/257). 패킷 `yoroi-256-257-review-r`. 요구사항: [team-top15-free-runners-dispatch-20261021.md](team-top15-free-runners-dispatch-20261021.md).
- 대상: 미커밋 변경. 수정 파일은 `letter-team-combinations.ts`·`letter-mermaid.ts`·`letter-three-role-pipeline.ts`·`composition/insights-three-role.ts`·`config/open-weight-models.json`·테스트 3개·문서 2개. 신규 파일은 `letter-team-runners.ts`(21줄). 기준 HEAD `bcc9de5`(#253 커밋 완료).
- 방법: `git diff`와 전체 파일 읽기, 실제 함수를 쓴 프로브(`tmp/yoroi-256-257-r-probe.ts`, 리뷰 후 삭제), 검증 재실행. 격리 스냅샷은 생략했다(패킷 요청).

## 판정

**BLOCK**. 계약 1건이 충족되지 않는다. 점수 없는 Free 후보를 총점에 0점으로 조용히 합산한다(`letter-team-combinations.ts:66`). 표시와 조합 선택에는 영향이 없어서 수정 범위는 작다. 나머지 항목은 모두 충족한다.

## 항목별 근거

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| #256 레지스트리 8개 | PASS | `config/open-weight-models.json` 8개 모두 `openWeights:true`, `evidenceUrl`, `checkedOn`, `license`, `note`를 가진다. `open-weight-correction-20261021.md:14`과 `open-weight-evidence-20261021.md:30`이 8개로 정정됐다 |
| #256 라이선스 실질 | 비차단 | Muse·MiniMax의 `license`는 "미확인 — 사용자 확인 후 별도 검토"이다(N3) |
| #257 Top15 후보 | PASS | `letter-three-role-pipeline.ts`가 `selection.top15`를 쓴다. 테스트 `team-combinations.test.ts:84` |
| Free는 워커 fallback만 | PASS | `composition/insights-three-role.ts:42-44`가 `m.verified` Free만 `free:true`로 넘긴다(점수 없음). `letter-team-combinations.ts:91`에서 워커 풀 끝에만 붙는다 |
| Free는 점수 후보가 부족할 때만 | PASS | 프로브: 점수 워커가 2명뿐일 때만 `worker:free-a(free)`가 3번째 슬롯에 들어갔다 |
| 차선 1개/역할, 조합 모델 제외 | PASS | 프로브: 조합에 쓰인 모델(o1·r1·w1 등)은 차선에 나오지 않는다. `letter-team-runners.ts:16-20`의 `picked` 제외 |
| 1+2 리뷰어 차선 | PASS | 프로브 best-1+2: `리뷰어 r1`. 1+2 슬롯에는 리뷰어가 없다 |
| 캡션은 펜스 밖, Mermaid에 차선 노드 없음 | PASS | 파이프라인은 펜스 뒤에 `\n\n${runnersUpCaption}`을 붙인다. 프로브 Mermaid에 차선 노드가 없다 |
| 후보 없으면 `-` | PASS | 프로브: 리뷰어·워커 차선이 `-` |
| 오픈/Free 라벨 | PASS | 오픈 조합 라벨 `오픈 웨이트·Free`. 노드 `· Free`, 캡션 `(Free)` |
| 0점 조용한 합산 금지 | **FAIL** | `letter-team-combinations.ts:66` `s.score ?? 0`. 프로브 best-1+1+3 총점 305 = 90+85+70+60+**0(free)**. 총점에 미측정 구분이 없다. 표시와 선택 결과에는 영향 없음(N1) |
| Top7/Top15·점수·순위 불변 | PASS | `letter-three-role.ts`·`letter-role-selection.ts`·`letter-three-role-render.ts`가 HEAD와 같다 |
| Free 표·실사용·댓글 3·publish·2역할 | PASS | `letter-markdown*.ts`·`insights-publish.ts`·`insights-cli.ts`·`letter-three-role-body.ts`·정책 파일이 HEAD와 같다 |
| Mermaid 고정 ID·라벨 이스케이프 | PASS | `letter-mermaid.ts:11-12` 이스케이프. 노드 ID는 `O/R/W1..`로 고정. 테스트 `mermaid.test.ts:13-33`, 펜스 2개 |
| 파일 100줄 이하 | PASS | 가장 긴 파일은 `letter-team-combinations.ts` 99줄과 테스트 2개 100줄 |

## 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | `tmp/yoroi-256-257-r-check.log`의 `TYPECHECK_EXIT=0` |
| node:test | PASS 1447/1447 | 같은 로그 `ℹ tests 1447` / `pass 1447` / `fail 0` |
| BDD | PASS 45/45 | `45 scenarios (45 passed)`, `635 steps (635 passed)` |
| build | PASS | `BUILD_EXIT=0`(tmp outDir) |
| validate-repo | 최종 실행 결과는 아래 | `tmp/yoroi-256-257-r-validate.log` |
| diff-check | 최종 실행 결과는 아래 | `git diff --check` |

## BLOCK 해소 조건

- `letter-team-combinations.ts:66`: 총점은 측정된 슬롯만 합산하고, 미측정(점수 없는 Free) 슬롯 수를 `TeamCombination`에 노출한다. 또는 미측정 슬롯이 있으면 총점을 `undefined`로 둔다. 테스트 `mermaid.test.ts:57`의 제목 "점수 없음은 합산만 제외"도 실제 구현에 맞춘다.

## 비차단 메모

- N1 캡션 이스케이프: 차선 캡션은 `modelId`를 이스케이프하지 않는다(`letter-mermaid.ts:37-38`). 프로브에서 줄바꿈과 백틱이 그대로 나왔다. 식별자가 외부 데이터에서 오므로 펜스 밖에서도 본문 구조를 깰 수 있다. `clean()` 또는 `escapeMermaidLabel` 적용을 권장한다.
- N2 구성 불가 조합의 차선: 프로브 open-1+1+3(구성 불가)에도 차선 캡션이 나온다. 빈 조합의 "차선"은 의미가 모호하다. 구성 불가일 때는 `-`로 두는 편이 낫다.
- N3 라이선스 미확인: Muse·MiniMax를 오픈 웨이트로 등록했고 라이선스는 "미확인"이다. 사용자 확인으로 판정했다는 근거는 있다. 발행 전에 사용자가 수용 여부를 확인한다.
- N4 근거 페이지: Muse는 models.dev, MiniMax는 블로그를 근거로 한다. 레지스트리 note가 공식 페이지와 불일치 가능성을 밝혔다.

## 커밋·발행 게이트

- 커밋 범위(#256·#257): 수정 `letter-team-combinations.ts`, `letter-mermaid.ts`, `letter-three-role-pipeline.ts`, `composition/insights-three-role.ts`, `config/open-weight-models.json`, 테스트 3개, 문서 `open-weight-evidence-20261021.md`·`team-combinations-20261021.md`. 신규 `letter-team-runners.ts`, `open-weight-correction-20261021.md`, `team-top15-free-runners-20261021.md`.
- 제외: 다른 작업의 미추적 문서(`free-*`, `next-*`, `reviewer-pareto-*`, `three-role-legend-result-*`).
- BLOCK 해소 후 커밋 범위만으로 `pnpm run check`를 다시 돌린다.

## 준수

코드·테스트·Top7 순위·Free 표·발행 계약·점수 가중치를 바꾸지 않았다. 외부 쓰기, 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그뿐이다.
