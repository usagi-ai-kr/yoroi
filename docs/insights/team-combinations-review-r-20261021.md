# 권장 조합 Mermaid 독립 리뷰 r (2026-10-21, #253)

- 이슈: [#253](https://github.com/usagi-ai-kr/yoroi/issues/253). 패킷 `yoroi-253-team-combinations-review-r`. 요구사항: [team-combinations-impact-20261021.md](team-combinations-impact-20261021.md).
- 대상: w3의 #253 미커밋 변경. 수정 파일은 `letter-three-role-pipeline.ts`·`letter-three-role-body.ts`·테스트 1개. 신규 파일은 `letter-team-combinations.ts`·`letter-mermaid.ts`·`config/open-weight-models.json`·테스트 2개. 기준 HEAD `b0e427a`(#252 커밋 완료).
- 방법: `git diff`와 신규 파일 전체 읽기, 테스트 단언 대조, 샘플 렌더 길이 측정(`tmp/yoroi-253-r-probe.ts`, 삭제함), 검증 명령 재실행. 격리 스냅샷은 생략했다(패킷 요청).

## 판정

**PASS**(#253 코드·테스트·본문 순서·Mermaid 안전성). **발행은 보류**한다. 커밋 범위 확정과 오픈 웨이트 정책 판단이 남아 있다(아래 게이트).

## 항목별 근거

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| 본문 순서(오케→리뷰→워커→조합→안내) | PASS | `letter-three-role-body.ts:23-25` 워커 뒤에 `## 🧩 권장 조합`과 블록을 넣는다. `tests/insights-three-role-body.test.ts:70-71`이 워커 < 조합 < 표시 안내를 단언. 교체 경로 `insights-cli.ts:72`는 미변경 |
| 슬롯 수 1+1+3=5, 1+2=3 | PASS | `letter-team-combinations.ts:30-31` COUNTS. `tests/insights-team-combinations.test.ts:14-22` |
| 리뷰어 없는 구성에 리뷰어 노드 없음 | PASS | 1+2는 `reviewer:0`이라 `choose(·,0)=[[]]`. 테스트 `:20`. Mermaid 간선은 O→W만 생긴다 |
| 조합 내 identityKey 유일 | PASS | `letter-team-combinations.ts:64-65` `new Set(keys)` 검사. 테스트 `:24-31` |
| 전수 탐색·합산 최대 | PASS | `:60-71` 모든 조합 열거(1+1+3, 7명 기준 1,715개). 그리디 역전 테스트 `:33-42`(B+R+A/C/D=325) |
| 동점·부족·구성 불가에서 가짜 모델 없음 | PASS | 부족은 `slots:[]`+사유(`:73-85`). 테스트 `:44-51`. 결정론 `:53-59` |
| 오픈 웨이트 = 검증 6개만 | PASS | `config/open-weight-models.json` 6개 모두 `openWeights:true`, `evidenceUrl`, `checkedOn 2026-10-21`, `license`. 테스트 `:70-75`가 6개와 제외 목록(Muse·MiniMax·Gemini·GPT·Claude·Grok) 부재를 단언 |
| Mermaid 고정 ID·라벨 이스케이프·펜스 | PASS | `letter-mermaid.ts:6`·`:24-27` 고정 `O/R/W1..`. `:10` 이스케이프(백틱·따옴표·대괄호·`#;` 제거). 테스트 `insights-mermaid.test.ts:24-32` 펜스 정확히 2개 |
| 구성 불가는 가짜 모델 없이 사유 | PASS | `letter-mermaid.ts:17-19` `NA` 노드에 이스케이프된 사유만. 테스트 `:33-38` |
| Top7/Top15·Free 표·실사용·댓글 3개·2역할 | PASS | `letter-three-role.ts`·`letter-role-selection.ts`·`letter-markdown*.ts`·`letter-three-role-render.ts`·`insights-cli.ts`·`insights-publish.ts`·정책 파일 모두 HEAD와 동일(diff 빈 결과) |
| publish 계약 | PASS | `insights-publish.ts:52`의 검사는 그대로(본문 비어 있음·댓글 3개). 인터페이스 `combinations?`는 선택 필드 추가뿐 |
| 본문 길이 | PASS(여유 큼) | 샘플 4블록 620자 문자/841바이트(일부 구성 불가 포함). 실측 본문은 6,683자(`release-103-letter-publication.md`)로 한도 65,536자 대비 여유가 크다. 교체 후 재절단은 없다(`letter-markdown.ts:47` 교체 전 절단) |

## 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | `tmp/yoroi-253-r-check.log` `TYPECHECK_EXIT=0` |
| node:test | PASS 1442/1442 | 같은 로그 `ℹ tests 1442` / `pass 1442` / `fail 0` |
| BDD | PASS 45/45 | 같은 로그 `45 scenarios (45 passed)`, `635 steps` |
| build | PASS | `BUILD_EXIT=0`(tmp outDir) |
| validate-repo | PASS | exit 0, 1039 files(`tmp/yoroi-253-r-validate.log`) |
| diff-check | PASS | `git diff --check` exit 0 |
| 100줄 이하 | PASS | `letter-team-combinations.ts` 99줄, `letter-mermaid.ts` 30, `letter-three-role-pipeline.ts` 91, `letter-three-role-body.ts` 43, 신규 테스트 최대 75 |

## 비차단 메모

- **N1 합산 처리**: `letter-team-combinations.ts:67`의 `s.score ?? 0`은 점수 없는 후보를 0으로 더한다. 합계는 화면에 나오지 않으므로 표시 오류는 없다. 다만 가정이 조용하다.
- **N2 동점 규칙**: 설계의 "역할 우선순위 → 슬롯별 점수 → identityKey"를 명시 비교자로 구현하지 않았다. 대신 `:68` 엄격 `>`와 입력 정렬 순서로 결정론을 얻는다(테스트 `:53-59`).
- **N3 조건부 라이선스**: GLM-5.3(MaaS 보안 심사 조건)과 Kimi K3(MaaS·표시 조건)를 `openWeights:true`로 등록했다. 조건부 라이선스를 '오픈 웨이트'로 볼지는 정책 판단이다. 사용자 결정이 필요하다.
- **N4 근거 URL**: 근거 URL은 존재만 확인했다. 이번 리뷰에서 외부 접속으로 검증하지 않았다.

## 커밋·발행 게이트

- **#253 커밋 범위**: 수정 파일 `letter-three-role-pipeline.ts`·`letter-three-role-body.ts`·`tests/insights-three-role-body.test.ts`. 신규 파일 `src/insights/letter-team-combinations.ts`·`src/insights/letter-mermaid.ts`·`config/open-weight-models.json`·`tests/insights-team-combinations.test.ts`·`tests/insights-mermaid.test.ts`. 문서 `docs/insights/team-combinations-20261021.md`·`docs/insights/open-weight-evidence-20261021.md`. 레지스트리 파일을 빠뜨리면 오픈 조합이 조용히 '구성 불가'가 된다.
- **사용자 판단**: N3(조건부 라이선스 포함 여부)을 정한 뒤 발행한다.
- 발행 전에 커밋 범위만으로 `pnpm run check`를 다시 돌린다.

## 준수

코드·테스트·Top7 순위·Free 표·발행 계약을 바꾸지 않았다. 외부 쓰기, 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그뿐이다.
