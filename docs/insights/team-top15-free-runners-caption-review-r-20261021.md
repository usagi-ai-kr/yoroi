# 추천 조합 차선 캡션 정정 재리뷰 r (2026-10-21, #257)

- 이슈: [#257](https://github.com/usagi-ai-kr/yoroi/issues/257)(#256 정정 위에 구현). 패킷 `yoroi-257-caption-fix-rereview-r`. 요구사항: [team-top15-free-runners-dispatch-20261021.md](team-top15-free-runners-dispatch-20261021.md). 이전 리뷰: [team-top15-free-runners-rereview-r-20261021.md](team-top15-free-runners-rereview-r-20261021.md)(PASS).
- 대상: 미커밋 정정분. 사용자 정정: 1+2 조합(리뷰어 슬롯 없음)의 캡션에 리뷰어 차선을 넣지 않는다. 관련 파일은 `letter-team-runners.ts`(29줄), `letter-mermaid.ts`(50줄), `letter-team-combinations.ts`(100줄), `letter-three-role-pipeline.ts`(93줄), 테스트 3개. 기준 HEAD `bcc9de5`.
- 방법: 수정 코드 전체 읽기, 실제 함수를 쓴 프로브(`tmp/yoroi-257-r3-probe.ts`, 리뷰 후 삭제), 불변 파일 diff, 검증 재실행. 격리 스냅샷은 생략했다(패킷 요청).

## 판정

**PASS**. 1+2 리뷰어 차선 정정이 반영됐다. 구성 불가 `-`, 펜스 밖 캡션, 조합 모델 재사용 금지, 총점 측정 기준은 모두 유지된다. 새 차단 사유는 없다.

## 정정 검증 (1+2 리뷰어 차선)

| 확인 | 결과 | 근거 |
| --- | --- | --- |
| 1+2 best 캡션에 리뷰어 없음 | PASS | 프로브: `- 차선: 오케스트레이터 o2 · 워커 w3`. 테스트 `mermaid.test.ts:53-54` |
| 1+2 open 캡션에 리뷰어 없음 | PASS | 프로브: `- 차선: 오케스트레이터 - · 워커 free-a (Free)`. 테스트 `mermaid.test.ts:81-85` |
| 1+1+3 은 오케·리뷰어·워커 모두 | PASS | 프로브 best: `오케스트레이터 o2 · 리뷰어 - · 워커 free-a (Free)`. 테스트 `:49-52` |
| 역할 제한 방식 | PASS | `letter-team-combinations.ts:84` `runnersUp(plan, picked, slots의 역할)`. `letter-team-runners.ts:23-26` `want(role)`로 조합에 없는 역할은 계산하지 않음. `letter-mermaid.ts:45-49`가 `roles` 기준으로 줄을 만든다 |

## 나머지 확인

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 구성 불가 캡션 `-`, 가짜 후보 없음 | PASS | `letter-team-combinations.ts:85` `runnersUp: {}`. 프로브 4개 구성 불가 모두 `-`. 테스트 `mermaid.test.ts:69` |
| 캡션은 펜스 밖 | PASS | `letter-three-role-pipeline.ts:70` 렌더 결과 뒤에 캡션. 프로브 4개 모두 `captionAfterFence=true`. 테스트 `:55` |
| 차선이 조합 모델을 재사용하지 않음 | PASS | 프로브 4개 조합 모두 `reused=[]`. `letter-team-runners.ts:21-22` `picked` 제외 |
| Top15 후보 | PASS | `letter-three-role-pipeline.ts:67-69`가 `selection.*.top15`를 쓴다 |
| Free 워커 fallback, 무점수, 필요 시만 | PASS | 프로브: Free 슬롯 `score` 없음. 점수 워커가 부족할 때만 사용 |
| 총점 측정 기준·미측정 노출 | PASS | `letter-team-combinations.ts:67-68` 측정 슬롯만 합산, 미측정 수 집계. `:84` 노출. 비교는 측정 총점 desc → 미측정 asc → 선착 |
| Mermaid 고정 ID·라벨 이스케이프·펜스 | PASS | `letter-mermaid.ts:8` 고정 ID, `:11-12` 라벨 이스케이프, `:15` 고정 펜스, `:18-33` 렌더. 정정으로 바뀌지 않음 |
| Top7/Top15·Free 표·댓글·publish·2역할 | PASS | `letter-markdown*.ts`, `letter-three-role.ts`, `letter-role-selection.ts`, `letter-three-role-render.ts`, `insights-publish.ts`, `insights-cli.ts`, `letter-three-role-body.ts`, 정책 파일이 HEAD와 같다(diff 빈 결과) |

## 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | `tmp/yoroi-257-r3-check.log`의 `TYPECHECK_EXIT=0` |
| node:test | PASS 1450/1450 | 같은 로그 `ℹ tests 1450` / `pass 1450` / `fail 0` |
| BDD | PASS 45/45 | `45 scenarios (45 passed)`, `635 steps (635 passed)` |
| build | PASS | `BUILD_EXIT=0`(tmp outDir) |
| validate-repo | PASS | exit 0, 1046 files(`tmp/yoroi-257-r3-validate.log`) |
| diff-check | PASS | `git diff --check` exit 0 |
| 100줄 이하 | PASS | `letter-team-combinations.ts` 100(한계), `letter-mermaid.ts` 50, `letter-team-runners.ts` 29, 테스트 최대 100 |

## 비차단 메모

- N1 캡션 역할 목록은 `roles` 메타데이터에 의존한다(`letter-team-runners.ts:16`). 조합 빌더는 항상 `roles`를 넘기므로 현재 경로는 정확하다. 직접 호출에서 `roles`를 빠뜨리면 모든 역할이 나온다. 방어적 기본값이 필요할 수 있다.
- N2 `letter-team-combinations.ts`가 여전히 정확히 100줄이다. 다음 수정에서는 helper 분리가 필요하다.
- N3 라이선스: Muse·MiniMax 라이선스는 "미확인"이다(이전 리뷰 N5 유지). 발행 전에 사용자가 수용 여부를 확인해야 한다.

## 커밋·발행 게이트

- 커밋 범위는 이전 리뷰와 같다(수정 10개, 신규 3개). 커밋 범위만으로 `pnpm run check`를 다시 돌린다.
- 발행 전에 N3를 사용자가 확인한다.

## 준수

코드·테스트·Top7 순위·Free 표·발행 계약·점수를 바꾸지 않았다. 점수를 새로 만들지 않았다. 외부 쓰기, 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그뿐이다.
