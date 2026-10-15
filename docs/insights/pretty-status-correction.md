# yo 기본 상태 표시 정정 (2026-10-15 12:1x 사용자 지시)

- 최신 규칙: yo(once --pretty)는 limit·under·optimal·over만 표시하고 n/a 창은 숨긴다.
- 이전 under·n/a·optimal 규칙을 대체한다. yo2(--pretty --full)와 plain은 전체 표시 유지.
- 기존 숨김 provider 요약·공급자 오류 처리는 유지하되 옛 over/limit 숨김 안내는 새 규칙에 맞춘다.
- 승인: 91c1d71·dc11e8c·28af461 + 이번 표시 정정을 dev push하고 0.12.1 PR 생성.
- 신규 issue·milestone 생성 금지. main머지·tagRelease·전역설치는 이번 범위 밖이다.
- 기존3커밋은 보존하고 표시정정은 새 작업단위커밋으로 추가한다(amend/rebase금지).

| 단계1 | 담당 | 소유 |
| --- | --- | --- |
| 표시 구현 | w2 | render-pretty-filter.ts·render.ts |
| 표시 테스트·BDD 정정 | w3 | 지정 pretty 테스트·cli-pretty-full feature·관련fixture/step |
| 현재 0.12.1 준비 문서 정정 | w1 | development·roadmap·release-status·tasks |

- 진행보고 scratch/reports/yoroi-pretty-{core-w2,tests-w3,docs-w1}.json.
- 단계1 완료 보고 뒤 w4 독립리뷰·통합검증을 별도 배정한다.
- 기본4상태양성·n/a창음성·full에서n/a포함·plain/오류/숨김요약 보호를 검증한다.
- 실제 공급자 API 호출·개인사용량노출·.zshrc 재수정·README/AGENTS 수정 금지.
- 코드문서파일100줄, 단위5분, 단계1커밋push금지·소유밖수정금지.
- 중단시 새작업을 멈추고 진행변경을 보존하여 보고한다.


## 현행 안내 보완

- 독립영향점검에서 --full 도움말의 including over and limit 문구가남아있음을확인했다.
- w2에 help.ts를별도배정해 including n/a로갱신한다.
- 해당help기대는 w3소유 cli-pretty-full.test.ts 안의1줄이며 최신동작에맞춰함께검증한다.
- 과거0.12.0발행문서의옛규칙은당시이력으로보존한다.


## 테스트 후속 범위

- w3 본단위완료: pretty7종 및 BDD45/45 통과. window-order 테스트의 n/a 정렬fixture 영향 발견.
- w3에 window-order.test.ts 추가소유를부여해 정렬검증은full전체경로로명확히보호한다.
- cli-args.test.ts의무관한빈줄정리는HEAD원형으로복원한다.
- help.ts 안내갱신과 cli-pretty-full.test.ts 도움말기대 including n/a를결합검증한다.
- 독립리뷰·최종통합검증은 이후속완료보고를기준으로한다.


## 최종 통합 확인

- 1차전체검증: typecheck·build·BDD45/45 PASS, 단위976/977(window-order 구기대1건).
- w3후속에서 정렬full검증·help기대정정·무관서식원복 완료, 일반/CI타깃18/18 PASS.
- w2는 후속완료트리로 CI=true 전체unit만재검증한다. 다른통과검증은중복하지않는다.
- w4 approve와 최종unit PASS 후 표시정정 새커밋·승인범위dev push·0.12.1 PR생성.
- 신규issue·milestone·설정생성 및 main머지·tagRelease·전역갱신은실행하지않는다.
